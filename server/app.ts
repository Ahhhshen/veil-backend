import ContentCabinetConcept from "./concepts/contentcabinet";
import DiscoveryConcept from "./concepts/discovery";
import FriendConcept from "./concepts/friend";
import MeetupConcept from "./concepts/meetup";
import PostConcept from "./concepts/post";
import TagConcept from "./concepts/tag";
import TimeLimitedEngagementConcept from "./concepts/timelimitedengagement";
import UserConcept from "./concepts/user";
import WebSessionConcept from "./concepts/websession";

// App Definition using concepts
export const WebSession = new WebSessionConcept();
export const User = new UserConcept();
export const ContentCabinet = new ContentCabinetConcept();
export const Post = new PostConcept();
export const Friend = new FriendConcept();
export const Tag = new TagConcept();
export const TimeLimitedEngagement = new TimeLimitedEngagementConcept();
export const Meetup = new MeetupConcept(Friend.friends);
export const Discovery = new DiscoveryConcept(Post.posts, ContentCabinet.contentCabinets);
