import { getApps } from '@kentcdodds/workshop-utils/apps.server'
import {
	getServerTimeHeader,
	makeTimings,
} from '@kentcdodds/workshop-utils/timing.server'
import { type LoaderFunctionArgs, json } from '@remix-run/node'

export async function loader({ request }: LoaderFunctionArgs) {
	const timings = makeTimings('appsLoader')
	const apps = await getApps({ request, timings })
	return json(
		{ apps },
		{ headers: { 'Server-Timing': getServerTimeHeader(timings) } },
	)
}
