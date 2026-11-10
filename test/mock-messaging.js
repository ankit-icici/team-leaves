// Stand-in for Firebase Cloud Messaging in the private test copy. Test copy only.
export const isSupported = async () => true;
export const getMessaging = () => ({});
export const getToken = async () => "mock-push-token-" + (localStorage.getItem("tl:device") || "x");
