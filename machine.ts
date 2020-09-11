import { Machine, assign, send } from 'xstate'
// import NetInfo from '@react-native-community/netinfo'

import Pusher from 'pusher-js/react-native'

import { PUSHER_KEY } from './keys'

Pusher.logToConsole = false

const disconnectPusher = async (ctx, event) => {
    console.log('in disconnecting')
    if (ctx.pusher) {
        console.log('DICSONNECTING')
        ctx.pusher.disconnect()
    }
}

const createPusher = async (ctx) =>
    new Promise((res, rej) => {
        try {
            if (!PUSHER_KEY) {
                throw new Error('Oops, you need pusher key!')
            }

            const pusher = new Pusher(PUSHER_KEY, {
                // enabledTransports: ['ws', 'wss'],
                cluster: 'eu',
                forceTLS: true,
            })

            if (ctx.shouldFail) {
                setTimeout(() => rej('OOOPS'), 2000)
            } else {
                pusher.connection.bind('connected', () => {
                    res(pusher)
                })
            }
        } catch (err) {
            return rej(err)
        }
    })

const CONNECTION_LIVES = 3

export const pusherMachine = Machine(
    {
        initial: 'idle',
        context: {
            pusher: null,
            channel: null,
            lastError: null,
            lives: CONNECTION_LIVES,
            shouldFail: false,
        },
        activities: 'network',
        on: {
            RESET: 'disconnecting',
            // TODO shouldn't be in the final version of course
            SHOULD_FAIL_SWITCH: {
                actions: 'toggleShouldFail',
            },
            FAILED: {
                target: '#failed',
                actions: 'handleErrorMessage',
            },
            RECONNECT: {
                target: '#initializing',
            },
            OFFLINE: '#offline',
        },
        states: {
            idle: {
                id: 'idle',
                on: {
                    CONNECT: 'initializing',
                    RECONNECT: 'initializing',
                },
            },
            connected: {
                id: 'connected',
            },
            initializing: {
                id: 'initializing',
                initial: 'disconnecting',
                states: {
                    disconnecting: {
                        invoke: {
                            src: disconnectPusher,
                            onDone: 'creatingInstance',
                            onError: [
                                {
                                    target: '#initializing',
                                    actions: [
                                        'removeLive',
                                        'handleErrorMessage',
                                    ],
                                    cond: 'stillHaveLives',
                                },
                                {
                                    target: '#failed',
                                    actions: ['handleErrorMessage'],
                                },
                            ],
                        },
                    },

                    creatingInstance: {
                        invoke: {
                            id: 'createPusher',
                            src: createPusher,
                            onDone: {
                                target: 'subscribing',
                                actions: ['setPusher'],
                            },
                            onError: [
                                {
                                    target: 'creatingInstance',
                                    actions: [
                                        'removeLive',
                                        'handleErrorMessage',
                                    ],
                                    cond: 'stillHaveLives',
                                },
                                {
                                    target: '#failed',
                                    actions: ['handleErrorMessage'],
                                },
                            ],
                        },
                    },
                    subscribing: {
                        type: 'final',
                        invoke: {
                            id: 'subscribingToChannel',
                            src: async (ctx) => {
                                const channel = ctx?.pusher?.subscribe('hal')

                                return new Promise((res, rej) => {
                                    channel.bind(
                                        'pusher:subscription_succeeded',
                                        () => res(channel)
                                    )
                                    channel.bind(
                                        'pusher:subscription_error',
                                        (err) => rej(err)
                                    )
                                })
                            },
                            onDone: {
                                target: '#connected',
                                actions: ['setChannel', 'resetLives'],
                            },
                            onError: [
                                {
                                    target: 'subscribing',
                                    actions: [
                                        'removeLive',
                                        'handleErrorMessage',
                                    ],
                                    cond: 'stillHaveLives',
                                },
                                {
                                    target: '#failed',
                                    actions: ['handleErrorMessage'],
                                },
                            ],
                        },
                    },
                },
                onDone: {
                    actions: () => console.log('done init'),
                },
            },
            disconnecting: {
                invoke: {
                    src: disconnectPusher,
                    onDone: {
                        target: 'idle',
                        actions: ['reset'],
                    },
                },
            },
            offline: {
                id: 'offline',
            },
            failed: {
                onEntry: 'resetLives',
                id: 'failed',
            },
        },
    },
    {
        // activities: {
        //     network: () => {
        //         const removeListener = NetInfo.addEventListener((state) => {
        //             if (!state.isConnected) {
        //                 console.warn('OFFLINE')
        //                 send('OFFLINE')
        //             }
        //         })

        //         // Return a function that stops the beeping activity
        //         return removeListener
        //     },
        // },
        guards: {
            stillHaveLives: (ctx) => Boolean(ctx.lives),
        },
        actions: {
            reset: assign({
                pusher: () => null,
                channel: () => null,
                lastError: () => null,
                lives: () => CONNECTION_LIVES,
                shouldFail: () => false,
            }),
            setPusher: assign({
                pusher: (ctx, event) => event.data,
            }),
            setChannel: assign({
                channel: (ctx, event) => event.data,
            }),
            handleErrorMessage: assign({
                lastError: (ctx, event) => event.data,
            }),
            removeLive: assign({
                lives: (ctx) => ctx.lives - 1,
            }),
            resetLives: assign({
                lives: (_) => CONNECTION_LIVES,
            }),
            toggleShouldFail: assign({
                shouldFail: (ctx, event) => event.value,
            }),
            // saveNewEvent: assign({
            //     eventList: (ctx, event) => {
            //         const eventName = event.data()
            //         console.log('new event data')
            //         return [...ctx.eventList, eventName]
            //     },
            // }),
        },
    }
)
