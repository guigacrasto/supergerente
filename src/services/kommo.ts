import axios, { AxiosInstance } from "axios";
import { KommoConfig, Lead, Message } from "../types/index.js";
import qs from "qs";

export class KommoService {
    public client: AxiosInstance;
    private config: KommoConfig;

    constructor(config: KommoConfig) {
        this.config = config;
        this.client = axios.create({
            baseURL: `https://${config.subdomain}.kommo.com/api/v4`,
            headers: {
                Authorization: `Bearer ${config.accessToken}`,
                "Content-Type": "application/json",
            },
            paramsSerializer: {
                serialize: (params) => qs.stringify(params, { arrayFormat: 'brackets' })
            }
        });
    }

    public async getRecentLeads(limit: number = 10): Promise<Lead[]> {
        try {
            const response = await this.client.get("/leads", {
                params: {
                    limit,
                    order: "created_at",
                }
            });
            return response.data?._embedded?.leads || [];
        } catch (error) {
            console.error("Error fetching leads:", error);
            throw error;
        }
    }

    public async getLeadDetails(id: number): Promise<Lead> {
        try {
            const response = await this.client.get(`/leads/${id}`, {
                params: {
                    with: "contacts"
                }
            });
            return response.data;
        } catch (error) {
            console.error(`Error fetching lead ${id}:`, error);
            throw error;
        }
    }

    public async getLeadNotes(id: number): Promise<any[]> {
        try {
            const response = await this.client.get(`/leads/${id}/notes`);
            return response.data?._embedded?.notes || [];
        } catch (error) {
            console.error(`Error fetching notes for lead ${id}:`, error);
            throw error;
        }
    }

    public async addNote(leadId: number, text: string): Promise<any> {
        try {
            const response = await this.client.post(`/leads/${leadId}/notes`, [
                {
                    note_type: "common",
                    params: {
                        text: text,
                    },
                },
            ]);
            return response.data;
        } catch (error) {
            console.error(`Error adding note to lead ${leadId}:`, error);
            throw error;
        }
    }

    public async getUsers(): Promise<any[]> {
        try {
            const response = await this.client.get("/users");
            return response.data?._embedded?.users || [];
        } catch (error) {
            console.error("Error fetching users:", error);
            throw error;
        }
    }

    public async getEvents(params: { filter?: any; limit?: number } = {}): Promise<any[]> {
        try {
            const response = await this.client.get("/events", {
                params: {
                    limit: params.limit || 100,
                    filter: params.filter,
                },
            });
            return response.data?._embedded?.events || [];
        } catch (error) {
            console.error("Error fetching events:", error);
            throw error;
        }
    }

    public async getPipelines(): Promise<any[]> {
        try {
            const response = await this.client.get("/leads/pipelines");
            return response.data?._embedded?.pipelines || [];
        } catch (error) {
            console.error("Error fetching pipelines:", error);
            throw error;
        }
    }

    public async getLeads(params: { limit?: number; filter?: any; sort?: any } = {}): Promise<Lead[]> {
        try {
            let allLeads: Lead[] = [];
            let page = 1;
            const limit = params.limit || 250;

            while (true) {
                console.log(`[Kommo] Fetching leads page ${page}...`);
                const response = await this.client.get("/leads", {
                    params: {
                        limit: limit,
                        page: page,
                        filter: params.filter,
                        sort: params.sort
                    }
                });

                const leads = response.data?._embedded?.leads || [];
                if (leads.length === 0) break;

                allLeads = allLeads.concat(leads);

                // If we got fewer leads than the limit, we've reached the end
                if (leads.length < limit) break;

                // Safety break to prevent infinite loops in weird cases
                if (page > 100) {
                    console.warn("[Kommo] Reached 100 pages of leads, stopping for safety.");
                    break;
                }

                page++;
            }

            console.log(`[Kommo] Total leads fetched: ${allLeads.length}`);
            return allLeads;
        } catch (error) {
            console.error("Error fetching leads:", error);
            return [];
        }
    }
}
