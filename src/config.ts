// Single place the backend's base URL lives. `Saheli Backend — Auth, Profile & Family.postman_collection.json`
// (repo root) documents the API this points at.
//
// `localhost` resolves to the device/emulator itself, not your dev machine — swap this
// depending on what you're running on:
//   Android emulator  -> 'http://10.0.2.2:8080/api'      (current default)
//   iOS simulator      -> 'http://localhost:8080/api'
//   Physical device     -> 'http://<your-machine-LAN-IP>:8080/api'
//   Real deployed server -> its actual URL
export const API_BASE_URL = 'http://10.0.2.2:8080/api';
