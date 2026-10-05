# Final Project

### What it does

A personal dashboard that lets people track whether their phones, laptops, tablets and routers
still receive security updates, so they can replace or upgrade devices before they become an
easy target for hackers.

### Types and Fields

```graphql
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
```

### Relationships

```
Device -> Owner: each device has one owner
Device -> Model: each device is one model
Owner -> [Device]: each owner has many devices
```

### Queries

```graphql
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
```

### Mutations

```graphql
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
```
