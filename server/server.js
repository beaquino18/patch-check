import 'dotenv/config'
import mongoose from 'mongoose';
import Owner from './src/models/Owner.js';
import Model from './src/models/Model.js';
import Device from './src/models/Device.js';
import { ApolloServer } from "@apollo/server"; 
import { startStandaloneServer } from '@apollo/server/standalone'

await mongoose.connect(process.env.MONGO_URI)
console.log('Connected to MongoDB')

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
    allOwners: async () => await Owner.find(),
    getOwner: async (_, { id }) => await Owner.findById(id),
    allDevices: async () => await Device.find(),
    getDevice: async(_, { id }) => await Device.findById(id),
    getDevicesByStatus: async (_, { status }) => {
      const matchingModels = (await Model.find()).filter((model) =>
        getStatus(model) === status)
      const modelIds = matchingModels.map((model) => model.id)
      return await Device.find({ modelId: { $in: modelIds } })
    },
    getDevicesByOwner: async (_, { ownerId }) => await Device.find({ ownerId }),
    allModels: async () => await Model.find(),
    deviceCount: async () => await Device.countDocuments(),
  },

  Owner: {
    devices: async (parent) => await Device.find({ ownerId: parent.id }), 
  },

  Device: {
    owner: async (parent) => await Owner.findById(parent.ownerId),
    model: async (parent) => await Model.findById(parent.modelId) 
  },

  Model: {
    status: async (parent) => getStatus(parent),
  },
  Mutation: {
    addOwner: async (_, { name }) => Owner.create({ name}),
    updateOwner: async (_, { id, name }) => 
      await Owner.findByIdAndUpdate(id, { name }, { new: true}),
    addModel: async (_, { company, product, version, supportEndsOn }) =>
      await Model.create({ company, product, version, supportEndsOn }),
    addDevice: async (_, { nickname, ownerId, modelId, purchasedOn }) => {
      const owner = await Owner.findById(ownerId)
      const model = await Model.findById(modelId)

      if (!owner) {
        throw new Error("Owner not found")
      }

      if (!model) {
        throw new Error("Model not found")
      }
      const device = Device.create({nickname, ownerId, modelId, purchasedOn })
      return await device
    },
    deleteDevice: async (_, { id }) => {
      const result = await Device.findByIdAndDelete(id)
      return await result !== null
    },
    updateDevice: async (_, { id, nickname, ownerId, modelId, purchasedOn}) => {
      const update = {}

      if (nickname !== undefined) update.nickname = nickname
      if (purchasedOn !== undefined) update.purchasedOn = purchasedOn

      if (ownerId !== undefined) {
        const owner = await Owner.findById(ownerId)
        if (!owner) {
          throw new Error("Owner not found")
        }
        update.ownerId = ownerId
      }

      if (modelId !== undefined) {
        const model = await Model.findById(modelId)
        if (!model) {
          throw new Error("Model not found")
        }
        update.modelId = modelId
      }
      
      const device = Device.findByIdAndUpdate(id, update, { new: true})
      return await device
    }
  }
}

const server = new ApolloServer({ typeDefs, resolvers })
const { url } = await startStandaloneServer(server, {
  listen: { port:4000 }
})

console.log(`Server ready at: ${url}`)
