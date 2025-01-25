import { ActionError, defineAction } from "astro:actions"
import { z } from "astro:schema"
import { CMS_URL } from "astro:env/server"
import type { Event } from "../content/loaders/payload/pages/getEvents"

export type User = {
	id: number
	name: string
	email: string
	loginAttempts: number
	profileImage: {
		url: string
	} | null
}

const cmsUrl = new URL(CMS_URL)
export const server = {
	login: defineAction({
		input: z.object({
			email: z.string().email(),
			password: z.string(),
		}),
		handler: async ({ email, password }, ctx) => {
			const headers = new Headers({
				"Content-Type": "application/json",
			})

			const res = await fetch(`${cmsUrl.origin}/api/users/login`, {
				method: "POST",
				headers,
				body: JSON.stringify({
					email,
					password,
				}),
			}).catch((e) => {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: e,
				})
			})
			if (res.status !== 200) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "Invalid email or password",
				})
			}
			// // Log res headers
			const setCookie = res.headers.get("set-cookie")

			let cookie
			const values = setCookie?.split(";")
			if (!values) return
			for (const value of values) {
				const pair = value.split("=")
				const key = pair[0].trim() as string | undefined
				const val = pair[1].trim() as string | undefined
				if (!key || !val) continue
				if (!cookie) {
					cookie = {
						[key]: val,
					}
				} else {
					cookie[key] = val as string
				}
			}

			if (!cookie || !cookie["payload-token"]) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "Couldnt parse cookie",
				})
			}
			ctx.cookies.set("payload-token", cookie["payload-token"], {
				sameSite: "lax",
				path: cookie["Path"],
				httpOnly: true,
				expires: new Date(cookie["Expires"]),
			})
			return true
		},
	}),
	verify: defineAction({
		handler: async (_, ctx) => {
			const headers = new Headers({
				"Content-Type": "application/json",
				Authorization: ctx.cookies.get("payload-token")?.value
					? `JWT ${ctx.cookies.get("payload-token")!.value}`
					: "",
			})

			const res = await fetch(`${cmsUrl.origin}/api/users/me`, {
				method: "GET",
				headers,
			})

			const body = (await res.json()) as {
				user: User | undefined
				message: "Account"
			}

			return body.user
		},
	}),
	logout: defineAction({
		handler: async (_, ctx) => {
			// const res = await fetch(`${cmsUrl}/api/users/logout`, {
			// 	method: "POST",
			// 	headers: {
			// 		"Content-Type": "application/json",
			// 	},
			// })
			ctx.cookies.delete("payload-token", {
				path: "/",
				sameSite: "lax",
			})
		},
	}),
	signup: defineAction({
		input: z.object({
			name: z.string(),
			email: z.string().email(),
			password: z.string(),
		}),
		handler: async ({ name, email, password }) => {
			const res = await fetch(`${cmsUrl.origin}/api/users`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name,
					email,
					password,
					role: "crew",
				}),
			})
			const data = await res.json()
			console.log(data, res.ok, res.status)
			if (res.status !== 201) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: data.message,
				})
			}
			return data
		},
	}),
	verifyAccount: defineAction({
		input: z.object({
			token: z.string(),
		}),
		handler: async ({ token }) => {
			const res = await fetch(
				`${cmsUrl.origin}/api/users/verify/${token}`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
				},
			)
			const data = await res.json()
			if (res.status !== 200) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: data.message,
				})
			}
			return data
		},
	}),
	getEventById: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			const res = await fetch(`${cmsUrl.origin}/api/events/${id}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			})
			const data = await res.json()
			if (res.status !== 200) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: data.message,
				})
			}
			return data as Event
		},
	}),
}
