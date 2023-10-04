import { ObjectId } from "mongodb";
import { BaseDoc } from "../framework/doc";

export interface MeetupDoc extends BaseDoc {
    attendees: ObjectId[]; // array of user ids
    name: string;
    type: "Virtual" | "In-Person";
    date: Date;
    location: string;
}

export interface MeetupInvitationDoc extends BaseDoc {
    from: ObjectId;
    to: ObjectId;
    status: "pending" | "rejected" | "accepted";
}

export default class MeetupConcept {}
