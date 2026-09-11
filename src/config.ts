import { Platform } from 'react-native';

// Single place the backend's base URL lives. `Saheli Backend — Auth, Profile & Family.postman_collection.json`
// (repo root) documents the API this points at.
//
// Currently pointed at a backend running locally on your own machine (port 8080).
//    Android emulator      -> 'http://10.0.2.2:8080/api'   (10.0.2.2 is the host from inside the emulator)
//    iOS simulator         -> 'http://localhost:8080/api'
//    Physical device       -> 'http://<your-machine-LAN-IP>:8080/api'
//    Real deployed server  -> 'https://ikon-vpm.keross.com/saheli/api'
export const API_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8080/api' : 'http://localhost:8080/api';

// Deployed backend — swap back to this before shipping a build:
// export const API_BASE_URL = 'https://ikon-vpm.keross.com/saheli/api';
//    Physical device        -> 'http://<your-machine-LAN-IP>:8080/api'
//   Real deployed server (current) -> 'https://ikon-vpm.keross.com/saheli/api'
// export const API_BASE_URL = 'https://ikon-vpm.keross.com/saheli/api';
// export const API_BASE_URL = 'http://10.0.2.2:8080/api';
//testing
