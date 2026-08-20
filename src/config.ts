// Single place the backend's base URL lives. `Saheli Backend — Auth, Profile & Family.postman_collection.json`
// (repo root) documents the API this points at.
//
// Currently pointed at the deployed backend. For local dev against a backend running on
// your own machine, swap this depending on what you're running on:
//   Android emulator     -> 'http://10.0.2.2:8080/api'
//   iOS simulator         -> 'http://localhost:8080/api'
//   Physical device        -> 'http://<your-machine-LAN-IP>:8080/api'
//   Real deployed server (current) -> 'https://ikon-vpm.keross.com/saheli/api'
export const API_BASE_URL = 'https://ikon-vpm.keross.com/saheli/api';
// export const API_BASE_URL = 'http://10.0.2.2:8080/api';