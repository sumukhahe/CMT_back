const ENV = {
  development: {
    apiUrl: "http://172.20.10.4:5000", // Your local development URL
  },
  production: {
    apiUrl: "https://cmt-back-1.onrender.com", // Your Render URL
  },
};

export default {
  apiUrl: __DEV__ ? ENV.development.apiUrl : ENV.production.apiUrl,
};
