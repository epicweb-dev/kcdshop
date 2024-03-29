import path from 'node:path'
import { invariantResponse } from '@epic-web/invariant'
import { makeTimings } from '@kentcdodds/workshop-utils/timing.server'
import {
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import fsExtra from 'fs-extra'
import { z } from 'zod'
import { resolveApps } from './__utils'
import { compileTs } from '#app/utils/compile-app.server'
import { getBaseUrl } from '#app/utils/misc'

export async function loader(args: LoaderFunctionArgs) {
	const apiModule = await getApiModule(args)
	invariantResponse(
		apiModule.loader,
		'Attempted to make a GET request to the api endpoint but the api module does not export a loader function',
		{ status: 405 },
	)
	return apiModule.loader(args)
}

export async function action(args: ActionFunctionArgs) {
	const apiModule = await getApiModule(args)
	invariantResponse(
		apiModule.action,
		'Attempted to make a non-GET request to the api endpoint but the api module does not export an action function',
		{ status: 405 },
	)
	return apiModule.action(args)
}

const ApiModuleSchema = z.object({
	loader: z.function().optional(),
	action: z.function().optional(),
})

async function getApiModule({ request, params }: LoaderFunctionArgs) {
	const timings = makeTimings('app-api')
	const { fileApp, app } = await resolveApps({ request, params, timings })
	if (!fileApp || !app) {
		throw new Response(`Apps not found`, { status: 404 })
	}
	if (app.dev.type === 'script') {
		throw redirect(getBaseUrl({ request, port: app.dev.portNumber }))
	}

	const apiFiles = (await fsExtra.readdir(app.fullPath))
		.filter((file: string) => /^api\.server\.(ts|tsx|js|jsx)$/.test(file))
		.map(f => path.join(app.fullPath, f))
	const apiFile = apiFiles[0]
	if (!apiFile) {
		throw new Response(
			`No api.server.(ts|tsx|js|jsx) file found in "${app.fullPath}"`,
			{ status: 404 },
		)
	}
	if (apiFiles.length > 1) {
		throw new Response(
			`Only one api.server.(ts|tsx|js|jsx) file is allowed, found ${apiFiles.join(', ')}`,
			{ status: 400 },
		)
	}

	const { outputFiles, errors } = await compileTs(apiFile, app.fullPath, {
		request,
		timings,
	})
	if (errors.length) {
		console.error(`Failed to compile file "${apiFile}"`)
		console.error(errors)
		throw new Response(errors.join('\n'), { status: 500 })
	}
	if (!outputFiles[0]) {
		throw new Response(`Failed to compile file "${apiFile}"`, { status: 500 })
	}
	const apiCode = outputFiles[0].text
	const dataUrl = `data:text/javascript;base64,${Buffer.from(apiCode).toString('base64')}`
	const mod = await import(/* @vite-ignore */ dataUrl)
	const apiModule = ApiModuleSchema.safeParse(mod)
	if (!apiModule.success) {
		throw new Response(
			`Invalid api module. It should export a loader and/or action: ${apiModule.error.message}`,
			{ status: 500 },
		)
	}
	return apiModule.data
}
