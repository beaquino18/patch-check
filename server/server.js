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
    allOwners: async (_, __, context) => await context.Owner.find(),
    getOwner: async (_, { id }, context) => await context.Owner.findById(id),
    allDevices: async (_, __, context) => await context.Device.find(),
    getDevice: async(_, { id }, context) => await context.Device.findById(id),
    getDevicesByStatus: async (_, { status }, context) => {
      const matchingModels = (await context.Model.find()).filter((model) =>
        getStatus(model) === status)
      const modelIds = matchingModels.map((model) => model.id)
      return await context.Device.find({ modelId: { $in: modelIds } })
    },
    getDevicesByOwner: async (_, { ownerId }, context) => await context.Device.find({ ownerId }),
    allModels: async (_, __, context) => await context.Model.find(),
    deviceCount: async (_, __, context) => await context.Device.countDocuments(),
  },

  Owner: {
    devices: async (parent, __, context) => await context.Device.find({ ownerId: parent.id }), 
  },

  Device: {
    owner: async (parent, __, context) => await context.Owner.findById(parent.ownerId),
    model: async (parent, __, context) => await context.Model.findById(parent.modelId) 
  },

  Model: {
    status: async (parent) => getStatus(parent),
  },
  Mutation: {
    addOwner: async (_, { name }, context) => context.Owner.create({ name}),
    updateOwner: async (_, { id, name }, context) => 
      await context.Owner.findByIdAndUpdate(id, { name }, { new: true}),
    addModel: async (_, { company, product, version, supportEndsOn }, context) =>
      await context.Model.create({ company, product, version, supportEndsOn }),
    addDevice: async (_, { nickname, ownerId, modelId, purchasedOn }, context) => {
      const owner = await context.Owner.findById(ownerId)
      const model = await context.Model.findById(modelId)

      if (!owner) {
        throw new Error("Owner not found")
      }

      if (!model) {
        throw new Error("Model not found")
      }
      const device = context.Device.create({nickname, ownerId, modelId, purchasedOn })
      return await device
    },
    deleteDevice: async (_, { id }, context) => {
      const result = await context.Device.findByIdAndDelete(id)
      return await result !== null
    },
    updateDevice: async (_, { id, nickname, ownerId, modelId, purchasedOn}, context) => {
      const update = {}

      if (nickname !== undefined) update.nickname = nickname
      if (purchasedOn !== undefined) update.purchasedOn = purchasedOn

      if (ownerId !== undefined) {
        const owner = await context.Owner.findById(ownerId)
        if (!owner) {
          throw new Error("Owner not found")
        }
        update.ownerId = ownerId
      }

      if (modelId !== undefined) {
        const model = await context.Model.findById(modelId)
        if (!model) {
          throw new Error("Model not found")
        }
        update.modelId = modelId
      }
      
      const device = context.Device.findByIdAndUpdate(id, update, { new: true})
      return await device
    }
  }
}

const server = new ApolloServer({ typeDefs, resolvers })
const { url } = await startStandaloneServer(server, {
  listen: { port:4000 },
  context: async () => ({ Owner, Model, Device })
})

console.log(`Server ready at: ${url}`)
