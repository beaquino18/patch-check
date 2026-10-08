import { ApolloServer } from "@apollo/server"; 
import { startStandaloneServer } from '@apollo/server/standalone'

const owners = [
  {
    id: "1",
    name: "Bea",
  },
  {
    id: "2",
    name: "Alex",
  },
]

const models = [
  {
    id: "1",
    company: "Apple",
    product: "iPhone",
    version: "15",
    supportEndsOn: "2029-09-01",
  },
  {
    id: "2",
    company: "Google",
    product: "Pixel",
    version: "7",
    supportEndsOn: "2025-12-31",
  },
  {
    id: "3",
    company: "Example Router Co.",
    product: "Home Router",
    version: "R1",
    supportEndsOn: null,
  },
  {
    id: "4",
    company: "Samsung",
    product: "Galaxy Tab",
    version: "S8",
    supportEndsOn: "2027-01-15",
  },
]

const devices = [
  {
    id: "1",
    nickname: "Bea's Phone",
    purchasedOn: "2024-01-15",
    ownerId: "1",
    modelId: "1",
  },
  {
    id: "2",
    nickname: "Alex's Phone",
    purchasedOn: "2022-08-10",
    ownerId: "2",
    modelId: "2",
  },
  {
    id: "3",
    nickname: "Living Room Router",
    purchasedOn: null,
    ownerId: "1",
    modelId: "3",
  },
  {
    id: "4",
    nickname: "Alex's Tablet",
    purchasedOn: "2023-06-15",
    ownerId: "2",
    modelId: "4",
  },
]

const typeDefs = `#graphql
  enum SupportStatus {
    SUPPORTED
    ENDING_SOON
    UNSUPPORTED
    UNKNOWN
  }

  type Owner {
    id: ID!
    name: String!
    devices: [Device!]!
  }

  type Model {
    id: ID!
    company: String!
    product: String!
    version: String!
    supportEndsOn: String
    status: SupportStatus!
  }

  type Device {
    id: ID!
    nickname: String!
    purchasedOn: String
    owner: Owner!
    model: Model!
  }

  type Query {
    allOwners: [Owner!]!
    getOwner(id: ID!): Owner
    allDevices: [Device!]!
    getDevice(id: ID!): Device
    getDevicesByStatus(status: SupportStatus!): [Device!]!
    getDevicesByOwner(ownerId: ID!): [Device!]!
    allModels: [Model!]!
    deviceCount: Int!
  }

  type Mutation {
    addOwner(name: String!): Owner!
    updateOwner(id: ID!, name: String!): Owner
    addModel(
      company: String!
      product: String!
      version: String!
      supportEndsOn: String
    ): Model!
    addDevice(
      nickname: String!
      ownerId: ID!
      modelId: ID!
      purchasedOn: String
    ): Device!
    deleteDevice(id: ID!): Boolean!
    updateDevice(
      id: ID!
      nickname: String
      ownerId: ID
      modelId: ID
      purchasedOn: String
    ): Device
  }
`

function getNextId(records) {
  const highestId = records.reduce(
    (highest, record) => Math.max(highest, Number(record.id)),
    0,
  )

  return String(highestId + 1)
}

function getStatus(model) {
  if (!model.supportEndsOn) {
    return "UNKNOWN"
  }

  const supportEnd = new Date(`${model.supportEndsOn}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (supportEnd < today) {
    return "UNSUPPORTED"
  }

  const sixMonthsFromToday = new Date(today)
  sixMonthsFromToday.setMonth(sixMonthsFromToday.getMonth() + 6)

  if (supportEnd <= sixMonthsFromToday) {
    return "ENDING_SOON"
  }

  return "SUPPORTED"
}

const resolvers = {
  Query: {
    allOwners: () => owners,
    getOwner:(_, { id }) => owners.find(o => o.id === id),
    allDevices: () => devices,
    getDevice:(_, { id }) => devices.find(d => d.id === id),
    getDevicesByStatus: (_, { status }) =>
      devices.filter((device) => {
        const model = models.find((model) => model.id === device.modelId)
        return model && getStatus(model) === status
      }),
    getDevicesByOwner: (_, { ownerId }) =>
      devices.filter((device) => device.ownerId === ownerId),
    allModels: () => models,
    deviceCount: () => devices.length,
  },

  Owner: {
    devices: (parent) => 
      devices.filter((device) => device.ownerId === parent.id), 
  },

  Device: {
    owner: (parent) =>
      owners.find((owner) => owner.id === parent.ownerId),
    model: (parent) => 
      models.find((model) => model.id === parent.modelId),
  },

  Model: {
    status: (parent) => getStatus(parent),
  },
  Mutation: {
    addOwner: (_, { name }) => {
      const owner = { id: getNextId(owners), name }
      owners.push(owner)
      return owner
    },
    updateOwner: (_, { id, name }) => {
      const owner = owners.find((owner) => owner.id === id)

      if (!owner) {
        return null
      }

      owner.name = name
      return owner
    },
    addModel: (_, { company, product, version, supportEndsOn }) => {
      const model = { id: getNextId(models), company, product, version, supportEndsOn }
      models.push(model)
      return model
    },
    addDevice: (_, { nickname, ownerId, modelId, purchasedOn }) => {
      const owner = owners.find((owner) => owner.id === ownerId)
      const model = models.find((model) => model.id === modelId)

      if (!owner) {
        throw new Error("Owner not found")
      }

      if (!model) {
        throw new Error("Model not found")
      }

      const device = { id: getNextId(devices), nickname, ownerId, modelId, purchasedOn }
      devices.push(device)
      return device
    },
    deleteDevice: (_, { id }) => {
      const deviceIndex = devices.findIndex((device) => device.id === id)

      if (deviceIndex === -1) {
        return false
      }

      devices.splice(deviceIndex, 1)
      return true
    },
    updateDevice: (_, { id, nickname, ownerId, modelId, purchasedOn}) => {
      const device = devices.find((device) => device.id === id)

      if (!device) {
        return null
      }

      if (nickname !== undefined) {
        device.nickname = nickname
      }

      if (ownerId !== undefined) {
        const owner = owners.find((owner) => owner.id === ownerId)
        if (!owner) {
          throw new Error("Owner not found")
        }
        device.ownerId = ownerId
      }

      if (modelId !== undefined) {
        const model = models.find((model) => model.id === modelId)

        if (!model) {
          throw new Error("Model not found")
        }
        device.modelId = modelId  
      }
      
      if (purchasedOn !== undefined) {
        device.purchasedOn = purchasedOn
      }
      
      return device
    }
  }
}

const server = new ApolloServer({ typeDefs, resolvers })
const { url } = await startStandaloneServer(server, {
  listen: { port:4000 }
})

console.log(`Server ready at: ${url}`)
