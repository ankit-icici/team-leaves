// Stand-in for Firebase Cloud Messaging in the private test copy. Test copy only.
// Behaves like the real thing in the way that matters for renewal: getToken keeps
// returning its saved address until the phone's push registration is removed,
// and deleteToken fails for an address Google has already dropped.
export const isSupported = async () => true;
export const getMessaging = () => ({});
export const getToken = async () => {
  let t = localStorage.getItem("mock:token");
  if (!t || localStorage.getItem("mock:unsub") === "1") {
    t = "mock-push-token-" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem("mock:token", t);
    localStorage.removeItem("mock:unsub");
  }
  return t;
};
export const deleteToken = async () => { throw new Error("Requested entity was not found"); };
