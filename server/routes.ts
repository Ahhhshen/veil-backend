import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { ContentCabinet, Discovery, Friend, Post, Tag, User, WebSession } from "./app";
import { PostDoc, PostOptions } from "./concepts/post";
import { TagDoc } from "./concepts/tag";
import { UserDoc } from "./concepts/user";
import { WebSessionDoc } from "./concepts/websession";
import Responses from "./responses";

class Routes {
  // ########################################################
  // User & Session Routes
  @Router.get("/session")
  async getSessionUser(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await User.getUserById(user);
  }

  @Router.get("/users")
  async getUsers() {
    return await User.getUsers();
  }

  @Router.get("/users/:username")
  async getUser(username: string) {
    return await User.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: WebSessionDoc, username: string, password: string) {
    WebSession.isLoggedOut(session);
    return await User.create(username, password);
  }

  @Router.patch("/users")
  async updateUser(session: WebSessionDoc, update: Partial<UserDoc>) {
    const user = WebSession.getUser(session);
    return await User.update(user, update);
  }

  @Router.delete("/users")
  async deleteUser(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    WebSession.end(session);
    return await User.delete(user);
  }

  @Router.post("/login")
  async logIn(session: WebSessionDoc, username: string, password: string) {
    const u = await User.authenticate(username, password);
    WebSession.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: WebSessionDoc) {
    WebSession.end(session);
    return { msg: "Logged out!" };
  }

  // ########################################################
  // Content Cabinet Routes
  @Router.get("/cabinet")
  async getContentCabinet(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    const cabinet = await ContentCabinet.getByOwner(user);
    return Responses.contentCabinet(cabinet);
  }

  @Router.post("/cabinet")
  async createContentCabinet(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    const created = await ContentCabinet.create(user);
    return { msg: created.msg, contentCabinet: created.contentCabinet };
  }

  // ########################################################
  // Post Routes
  @Router.get("/posts")
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const id = (await User.getUserByUsername(author))._id;
      posts = await Post.getByAuthor(id);
    } else {
      posts = await Post.getPosts({});
    }
    return Responses.posts(posts);
  }

  @Router.post("/posts")
  async createPost(session: WebSessionDoc, content: string, options?: PostOptions) {
    const user = WebSession.getUser(session);
    const created = await Post.create(user, content, options);
    const post = created.post;
    if (post) {
      // Add this post to the user's content cabinet
      await ContentCabinet.addContent(user, post._id);
      // Add this post's tags to the user's content cabinet
      if (post.tags) {
        await ContentCabinet.addTags(user, post.tags);
      }
      return { msg: created.msg, post };
    } else {
      throw new Error("Failed to create post");
    }
  }

  @Router.patch("/posts/:_id")
  async updatePost(session: WebSessionDoc, _id: ObjectId, update: Partial<PostDoc>) {
    const user = WebSession.getUser(session);
    await Post.isAuthor(user, _id);
    return await Post.update(_id, update);
  }

  @Router.delete("/posts/:_id")
  async deletePost(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    await Post.isAuthor(user, _id);
    // Remove this post from the user's content cabinet
    await ContentCabinet.removeContent(user, _id);
    // Remove this post's tags from the user's content cabinet
    const post = await Post.getById(_id);
    if (post.tags) {
      await ContentCabinet.removeTags(user, post.tags);
    }
    return Post.delete(_id);
  }

  // ########################################################
  // Tag Routes
  @Router.post("/tags/:name/:post_id")
  async createTag(session: WebSessionDoc, name: string, post_id: ObjectId) {
    const user = WebSession.getUser(session);
    const created = await Tag.create(user, name, [post_id]);
    // Sync the tag with the posts and user's content cabinet
    const tag = await Responses.tag(created.tag);
    if (tag) {
      // Add this tag to the post's tags
      tag.taggedposts.forEach(async (post) => {
        await Post.addTags(post, [tag._id]);
      });
      // Add this tag to the user's content cabinet
      await ContentCabinet.addTags(user, [tag._id]);
    }
    return { msg: created.msg, tag };
  }

  @Router.put("/tags/:_id/:post_id")
  async addTagToPost(session: WebSessionDoc, _id: ObjectId, post_id: ObjectId) {
    const user = WebSession.getUser(session);
    await Tag.isAuthor(user, _id);
    // Add this tag to the post's tags
    await Post.addTags(post_id, [_id]);
    // Add this post to the tag's taggedposts
    await Tag.addPosts(_id, [post_id]);
    return await Responses.tag(await Tag.getById(_id));
  }

  @Router.get("/tags")
  async getUserTags(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Responses.tags(await Tag.getByAuthor(user));
  }

  @Router.get("/tags/:post_id")
  async getPostTags(post_id: ObjectId) {
    const post = await Post.getById(post_id);
    if (post) {
      const tags = await Tag.tags.readMany({ _id: { $in: post.tags } });
      return await Responses.tags(tags);
    }
  }

  @Router.get("/tags/:id")
  async getTag(id: ObjectId) {
    return await Responses.tag(await Tag.getById(id));
  }

  @Router.patch("/tags/:id")
  async updateTag(session: WebSessionDoc, id: ObjectId, update: Partial<TagDoc>) {
    const user = WebSession.getUser(session);
    await Tag.isAuthor(user, id);
    return await Tag.update(id, update);
  }

  @Router.delete("/tags/:id")
  async deleteTag(session: WebSessionDoc, id: ObjectId) {
    const user = WebSession.getUser(session);
    await Tag.isAuthor(user, id);
    // Remove this tag from the user's content cabinet and all posts
    const tag = await Tag.getById(id);
    if (tag) {
      // remove this tag from all posts
      tag.taggedposts.forEach(async (post) => {
        await Post.removeTags(post, [tag._id]);
      });
      // remove this tag from the user's content cabinet
      await ContentCabinet.removeTags(user, [tag._id]);
      // remove this tag from the user's discovery's preference
      await Discovery.removeTagFromPreference(user, tag._id);
    }
    return await Tag.delete(id);
  }

  // ########################################################
  // Discovery Routes
  @Router.post("/discoveries")
  async createDiscovery(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    const created = await Discovery.create(user);
    return { msg: created.msg, discovery: created.discovery };
  }

  @Router.get("/discoveries/:numberOfPosts")
  async discoverNewPosts(session: WebSessionDoc, numberOfPosts?: number) {
    const user = WebSession.getUser(session);
    const posts = await Discovery.getDiscoverredPosts(user);
    const posts_to_update = posts.slice(0, numberOfPosts);
    return await Responses.posts(posts_to_update);
  }

  @Router.get("/discoveries")
  async getSeenPosts(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Responses.posts(await Discovery.getSeenPosts(user));
  }

  // ########################################################
  // Friend Routes
  @Router.get("/friends")
  async getFriends(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await User.idsToUsernames(await Friend.getFriends(user));
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: WebSessionDoc, friend: string) {
    const user = WebSession.getUser(session);
    const friendId = (await User.getUserByUsername(friend))._id;
    return await Friend.removeFriend(user, friendId);
  }

  @Router.get("/friend/requests")
  async getRequests(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Responses.friendRequests(await Friend.getRequests(user));
  }

  @Router.post("/friend/requests/:to")
  async sendFriendRequest(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    return await Friend.sendRequest(user, toId);
  }

  @Router.delete("/friend/requests/:to")
  async removeFriendRequest(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    return await Friend.removeRequest(user, toId);
  }

  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: WebSessionDoc, from: string) {
    const user = WebSession.getUser(session);
    const fromId = (await User.getUserByUsername(from))._id;
    return await Friend.acceptRequest(fromId, user);
  }

  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: WebSessionDoc, from: string) {
    const user = WebSession.getUser(session);
    const fromId = (await User.getUserByUsername(from))._id;
    return await Friend.rejectRequest(fromId, user);
  }

  // ########################################################
  // Meetup Routes

  // ########################################################
  // Time-limited Engagement Routes
}

export default getExpressRouter(new Routes());
