import { coreTypeDefs, coreResolvers } from "../../../packages/graphql-core/src/index.js";
import { typeDefs } from "./typeDefs";
import { resolvers as appResolvers } from "./appResolvers";

function mergeResolvers(base:any, extra:any){
  return {
    ...base, ...extra,
    Query: { ...(base.Query||{}), ...(extra.Query||{}) },
    Mutation: { ...(base.Mutation||{}), ...(extra.Mutation||{}) },
    Subscription: { ...(base.Subscription||{}), ...(extra.Subscription||{}) },
  };
}

export const mergedTypeDefs = [coreTypeDefs, typeDefs];
export const mergedResolvers = mergeResolvers(coreResolvers, appResolvers);
