import { Index as ConfettiShower } from 'confetti-react'
import { ClientOnly } from 'remix-utils/client-only'

export function Confetti({ id }: { id?: string | null }) {
	if (!id) return null

	return (
		<ClientOnly>
			{() => (
				<ConfettiShower
					key={id}
					run={Boolean(id)}
					recycle={false}
					numberOfPieces={800}
					width={window.innerWidth}
					height={window.innerHeight}
				/>
			)}
		</ClientOnly>
	)
}
