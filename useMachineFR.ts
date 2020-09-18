import React from 'react'
import { State, interpret } from 'xstate'

export function useMachineFR(machine, options = {}) {
    const {
        state: rehydratedState,
        context,
        guards,
        actions,
        activities,
        services,
        delays,
        ...interpreterOptions
    } = options

    const latestStateRef = React.useRef(null)

    const service = React.useMemo(
        () =>
            interpret(
                machine.withConfig(
                    {
                        context,
                        guards,
                        actions,
                        activities,
                        services,
                        delays,
                    },
                    {
                        ...machine.context,
                        ...context,
                    }
                ),
                interpreterOptions
            )
                .start(
                    rehydratedState
                        ? State.create(rehydratedState)
                        : latestStateRef.current
                        ? State.create(latestStateRef.current)
                        : undefined
                )
                .onTransition((state) => (latestStateRef.current = state)),
        []
    )

    const [state, setState] = React.useState(service.state)

    React.useEffect(() => {
        service.onTransition((state) => {
            if (state.changed) {
                setState(state)
            }
        })

        setState(service.state)

        return () => service.stop()
    }, [])

    React.useEffect(() => {
        Object.assign(service.machine.options.actions, actions)
    }, [actions])

    React.useEffect(() => {
        Object.assign(service.machine.options.services, services)
    }, [services])

    return [state, service.send, service]
}
