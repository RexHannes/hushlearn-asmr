import handler from "vinext/server/fetch-handler";

export default {
  fetch(request, env, context) {
    return handler.fetch(request, env, context);
  },
};
