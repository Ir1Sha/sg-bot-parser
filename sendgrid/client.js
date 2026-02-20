import axios from "axios";

export function createSendgridClient(apiKey) {
  return axios.create({
    baseURL: "https://api.sendgrid.com/v3",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
}
