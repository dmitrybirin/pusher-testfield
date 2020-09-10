import { Machine, assign, send } from 'xstate'

import Pusher from 'pusher-js/react-native'

import { PUSHER_KEY } from './keys'

// binding: {
//     invoke: {
//         id: 'bind',
//         src: (ctx) => (callback, onReceive) => {
//             console.log('binding')
//             // ctx.channel.bind('activate', (message) => {
//             //     console.log('data', message)
//             //     // assign({
//             //     //     message: () => message,
//             //     // })
//             //     callback('NEW_MESSAGE')
//             // })

//             return 'activate'

//             // return () => ctx.channel.unbind('activate')
//         },
//         onDone: [
//             {
//                 target: '#connected',
//                 actions: 'saveNewEvent',
//                 cond: 'hasNoOtherBindingsForEvent',
//             },
//             { target: '#connected' },
//         ],
//         onError: {
//             target: '#failed',
//             actions: ['handleErrorMessage'],
//         },
//     },
// },
// },

console.log({ PUSHER_KEY })

Pusher.logToConsole = false

const createPusher = async (ctx) =>
    new Promise((res, rej) => {
        try {
            if (!PUSHER_KEY) {
                throw new Error('Oops, you need pusher key!')
            }

            const pusher = new Pusher(PUSHER_KEY, {
                enabledTransports: ['ws', 'wss'],
                cluster: 'eu',
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
        on: {
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
        },
        states: {
            idle: {
                on: {
                    CONNECT: 'initializing',
                },
            },
            connected: {
                id: 'connected',
            },
            initializing: {
                id: 'initializing',
                initial: 'creatingInstance',
                states: {
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
            offline: {},
            failed: {
                onEntry: 'resetLives',
                id: 'failed',
            },
        },
    },
    {
        guards: {
            stillHaveLives: (ctx) => Boolean(ctx.lives),
        },
        actions: {
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
                lives: (ctx, event) => {
                    console.warn('removing live')
                    return ctx.lives - 1
                },
            }),
            resetLives: assign({
                lives: (ctx, event) => CONNECTION_LIVES,
            }),
            toggleShouldFail: assign({
                shouldFail: (ctx, event) => !ctx.shouldFail,
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
