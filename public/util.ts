type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type InputTag = "input" | "textarea";
type Field = InputTag | { [key: string]: Field };
type Fields = Record<string, Field>;

type operation = {
  name: string;
  endpoint: string;
  method: HttpMethod;
  fields: Fields;
};

const operations: operation[] = [
  // ########################################################
  // User & Session
  // ########################################################
  {
    name: "Get Session User (logged in user)",
    endpoint: "/api/session",
    method: "GET",
    fields: {},
  },
  {
    name: "Create User",
    endpoint: "/api/users",
    method: "POST",
    fields: { username: "input", password: "input" },
  },
  {
    name: "Login",
    endpoint: "/api/login",
    method: "POST",
    fields: { username: "input", password: "input" },
  },
  {
    name: "Logout",
    endpoint: "/api/logout",
    method: "POST",
    fields: {},
  },
  {
    name: "Update User",
    endpoint: "/api/users",
    method: "PATCH",
    fields: { update: { username: "input", password: "input" } },
  },
  {
    name: "Delete User",
    endpoint: "/api/users",
    method: "DELETE",
    fields: {},
  },
  {
    name: "Get Users (empty for all)",
    endpoint: "/api/users/:username",
    method: "GET",
    fields: { username: "input" },
  },
  // ########################################################
  // Content Cabinet
  // ########################################################
  {
    name: "Get Content Cabinet",
    endpoint: "/api/cabinet",
    method: "GET",
    fields: { owner: "input" },
  },
  {
    name: "Get Contents in Cabinet",
    endpoint: "/api/cabinet/contents",
    method: "GET",
    fields: {},
  },
  {
    name: "Create Content Cabinet",
    endpoint: "/api/cabinet",
    method: "POST",
    fields: {},
  },
  {
    name: "Veil content in Cabinet",
    endpoint: "/api/cabinet/veil/:content_id",
    method: "PATCH",
    fields: { content_id: "input" },
  },
  {
    name: "Unveil content in Cabinet",
    endpoint: "/api/cabinet/unveil/:content_id",
    method: "PATCH",
    fields: { content_id: "input" },
  },
  {
    name: "Remove Content from Cabinet",
    endpoint: "/api/cabinet/contents/:content_id",
    method: "PATCH",
    fields: { content_id: "input" },
  },
  {
    name: "Delete Content Cabinet",
    endpoint: "/api/cabinet",
    method: "DELETE",
    fields: {},
  },
  // ########################################################
  // Post
  // ########################################################
  {
    name: "Get Posts (empty for all)",
    endpoint: "/api/posts",
    method: "GET",
    fields: { author: "input" },
  },
  {
    name: "Create Post",
    endpoint: "/api/posts",
    method: "POST",
    fields: { content: "input" },
  },
  {
    name: "Update Post",
    endpoint: "/api/posts/:id",
    method: "PATCH",
    fields: { id: "input", update: { content: "input", options: { backgroundColor: "input" } } },
  },
  {
    name: "Delete Post",
    endpoint: "/api/posts/:id",
    method: "DELETE",
    fields: { id: "input" },
  },
  // ########################################################
  // Tag
  // ########################################################
  {
    name: "Create Tag for Post",
    endpoint: "/api/tags/:name/:post_id",
    method: "POST",
    fields: { name: "input", post_id: "input" },
  },
  {
    name: "Add Tag to Post",
    endpoint: "/api/tag/:id/:post_id",
    method: "PUT",
    fields: { id: "input", post_id: "input" },
  },
  {
    name: "Get Tags (empty for all)",
    endpoint: "/api/tags",
    method: "GET",
    fields: { author: "input" },
  },
  {
    name: "Get Tags by Post",
    endpoint: "/api/tags/:post_id",
    method: "GET",
    fields: { post_id: "input" },
  },
  {
    name: "Get Tag by Id",
    endpoint: "/api/tag/:id",
    method: "GET",
    fields: { id: "input" },
  },
  {
    name: "Update Tag",
    endpoint: "/api/tags/:id",
    method: "PATCH",
    fields: { id: "input", update: { name: "input" } },
  },
  {
    name: "Delete Tag",
    endpoint: "/api/tags/:id",
    method: "DELETE",
    fields: { id: "input" },
  },
  // ########################################################
  // Discovery
  // ########################################################
  {
    name: "Create Discovery",
    endpoint: "/api/discoveries",
    method: "POST",
    fields: {},
  },
  {
    name: "Discover New Posts",
    endpoint: "/api/discoveries/:numberOfPosts",
    method: "GET",
    fields: { numberOfPosts: "input" },
  },
  {
    name: "Get Seen Posts",
    endpoint: "/api/discovery/seen",
    method: "GET",
    fields: {},
  },
  {
    name: "Add Seen Post",
    endpoint: "/api/discovery/seen/:post_id",
    method: "PATCH",
    fields: { post_id: "input" },
  },
  {
    name: "Remove Seen Post",
    endpoint: "/api/discovery/seen/:post_id",
    method: "DELETE",
    fields: { post_id: "input" },
  },
  {
    name: "Delete Discovery",
    endpoint: "/api/discoveries/",
    method: "DELETE",
    fields: {},
  },
  // ########################################################
  // Friend
  // ########################################################
  {
    name: "Get friends",
    endpoint: "/api/friends",
    method: "GET",
    fields: {},
  },
  {
    name: "Delete friend",
    endpoint: "/api/friends/:friend",
    method: "DELETE",
    fields: { friend_name: "input" },
  },
  {
    name: "Get friend requests",
    endpoint: "/api/friend/requests",
    method: "GET",
    fields: {},
  },
  {
    name: "Send friend request",
    endpoint: "/api/friend/requests/:to",
    method: "POST",
    fields: { to: "input" },
  },
  {
    name: "Delete friend request",
    endpoint: "/api/friend/requests/:to",
    method: "DELETE",
    fields: { to: "input" },
  },
  {
    name: "Accept friend request",
    endpoint: "/api/friend/accept/:from",
    method: "PUT",
    fields: { from: "input" },
  },
  {
    name: "Reject friend request",
    endpoint: "/api/friend/reject/:from",
    method: "PUT",
    fields: { from: "input" },
  },

  // ########################################################
  // Meetup
  // ########################################################
  {
    name: "Get User Meetups",
    endpoint: "/api/meetups",
    method: "GET",
    fields: {},
  },
  {
    name: "Delete Meetup",
    endpoint: "/api/meetups/:friend",
    method: "DELETE",
    fields: { friend: "input" },
  },
  {
    name: "Get Meetup Invitations",
    endpoint: "/api/meetup/invitations",
    method: "GET",
    fields: {},
  },
  {
    name: "Send Meetup Invitation",
    endpoint: "/api/meetup/invitation/:to",
    method: "POST",
    fields: { to: "input" },
  },
  {
    name: "Delete Meetup Invitation",
    endpoint: "/api/meetup/invitation/:to",
    method: "DELETE",
    fields: { to: "input" },
  },
  {
    name: "Accept Meetup Invitation",
    endpoint: "/api/meetup/accept/:from",
    method: "PUT",
    fields: { from: "input" },
  },
  {
    name: "Reject Meetup Invitation",
    endpoint: "/api/meetup/reject/:from",
    method: "PUT",
    fields: { from: "input" },
  },
  // ########################################################
  // TimeLimitedEngagement
  // ########################################################
  {
    name: "Get User's TimeLimitedEngagements",
    endpoint: "/api/timelimitedengagements",
    method: "GET",
    fields: {},
  },
  {
    name: "Set TimeLimitedEngagement",
    endpoint: "/api/timelimitedengagement/:content_id/:time",
    method: "POST",
    fields: { content_id: "input", time: "input" },
  },
  {
    name: "Remove TimeLimitedEngagement",
    endpoint: "/api/timelimitedengagement/:content_id",
    method: "DELETE",
    fields: { content_id: "input" },
  },
];

// Do not edit below here.
// If you are interested in how this works, feel free to ask on forum!

function updateResponse(code: string, response: string) {
  document.querySelector("#status-code")!.innerHTML = code;
  document.querySelector("#response-text")!.innerHTML = response;
}

async function request(method: HttpMethod, endpoint: string, params?: unknown) {
  try {
    if (method === "GET" && params) {
      endpoint += "?" + new URLSearchParams(params as Record<string, string>).toString();
      params = undefined;
    }

    const res = fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: params ? JSON.stringify(params) : undefined,
    });

    return {
      $statusCode: (await res).status,
      $response: await (await res).json(),
    };
  } catch (e) {
    console.log(e);
    return {
      $statusCode: "???",
      $response: { error: "Something went wrong, check your console log.", details: e },
    };
  }
}

function fieldsToHtml(fields: Record<string, Field>, indent = 0, prefix = ""): string {
  return Object.entries(fields)
    .map(([name, tag]) => {
      return `
        <div class="field" style="margin-left: ${indent}px">
          <label>${name}:
          ${typeof tag === "string" ? `<${tag} name="${prefix}${name}"></${tag}>` : fieldsToHtml(tag, indent + 10, prefix + name + ".")}
          </label>
        </div>`;
    })
    .join("");
}

function getHtmlOperations() {
  return operations.map((operation) => {
    return `<li class="operation">
      <h3>${operation.name}</h3>
      <form class="operation-form">
        <input type="hidden" name="$endpoint" value="${operation.endpoint}" />
        <input type="hidden" name="$method" value="${operation.method}" />
        ${fieldsToHtml(operation.fields)}
        <button type="submit">Submit</button>
      </form>
    </li>`;
  });
}

function prefixedRecordIntoObject(record: Record<string, string>) {
  const obj: any = {}; // eslint-disable-line
  for (const [key, value] of Object.entries(record)) {
    if (!value) {
      continue;
    }
    const keys = key.split(".");
    const lastKey = keys.pop()!;
    let currentObj = obj;
    for (const key of keys) {
      if (!currentObj[key]) {
        currentObj[key] = {};
      }
      currentObj = currentObj[key];
    }
    currentObj[lastKey] = value;
  }
  return obj;
}

async function submitEventHandler(e: Event) {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const { $method, $endpoint, ...reqData } = Object.fromEntries(new FormData(form));

  // Replace :param with the actual value.
  const endpoint = ($endpoint as string).replace(/:(\w+)/g, (_, key) => {
    const param = reqData[key] as string;
    delete reqData[key];
    return param;
  });

  const data = prefixedRecordIntoObject(reqData as Record<string, string>);

  updateResponse("", "Loading...");
  const response = await request($method as HttpMethod, endpoint as string, Object.keys(data).length > 0 ? data : undefined);
  updateResponse(response.$statusCode.toString(), JSON.stringify(response.$response, null, 2));
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector("#operations-list")!.innerHTML = getHtmlOperations().join("");
  document.querySelectorAll(".operation-form").forEach((form) => form.addEventListener("submit", submitEventHandler));
});
