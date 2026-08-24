const getBaseUrl = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  return `${protocol}//${hostname}:${port}`;
};

const getServerUrl = () => {
  const savedIp = localStorage.getItem('serverIp');
  if (savedIp) {
    return `http://${savedIp}:3000`;
  }
  
  const hostname = window.location.hostname;
  
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'file') {
    return 'http://127.0.0.1:3000';
  }
  
  return `http://${hostname}:3000`;
};

const getSocketUrl = () => {
  return getServerUrl();
};

export { getBaseUrl, getServerUrl, getSocketUrl, getBaseUrl as getCurrentUrl };
export default getServerUrl;
