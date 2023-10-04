import { Filter, ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface DiscoveryDoc extends BaseDoc {
  referee: ObjectId; // the user who receives the discovery
  preference: ObjectId[]; // set of tags that the referee likes
}
