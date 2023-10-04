import { BaseDoc } from "../framework/doc";

export interface TimeLimitedEngagementDoc extends BaseDoc {
  content: ObjectId; // the post that is being engaged with
  user: ObjectId; // the user who is engaging with the post
  dateCreated: Date; // the date the engagement was created
  dateUpdated: Date; // the date the engagement was last updated
  dateExpires: Date; // the date the engagement will expire
}

export default class TimeLimitedEngagementConcept {}
