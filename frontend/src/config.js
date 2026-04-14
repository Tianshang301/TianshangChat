const PORT = 3000;

const getServerUrl = () => {
  const savedIp = localStorage.getItem('serverIp');
  if (savedIp) {
    return `http://${savedIp}:${PORT}`;
  }
  
  const hostname = window.location.hostname;
  
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'file') {
    return `http://127.0.0.1:${PORT}`;
  }
  
  return `http://${hostname}:${PORT}`;
};

const SERVER_URL = getServerUrl();
const API_URL = `${SERVER_URL}/api`;

export { SERVER_URL, API_URL, getServerUrl };
export default SERVER_URL;
