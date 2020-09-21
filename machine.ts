// @ts-nocheck
import { Machine, assign } from 'xstate'
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
                // authEndpoint: '/auth',
                auth: {
                    headers: {
                        'custom-auth-header': '1138',
                    },
                },
                authorizer: (channel) => {
                    console.log('channel: ', channel.name)
                    return {
                        authorize: async (socketId, callback) => {
                            console.log('AUTHORIZING WITH', socketId)
                            try {
                                const result = await fetch(
                                    'http://192.168.31.164:4444/auth',
                                    {
                                        method: 'POST',
                                        headers: {
                                            Accept: 'application/json',
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify({
                                            socket_id: socketId,
                                            channel_name: channel.name,
                                        }),
                                    }
                                )

                                const data = await result.json()

                                console.log({ data })

                                return callback(null, data)
                            } catch (error) {
                                console.log(error)
                                return callback(error, null)
                            }
                        },
                    }
                },
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

const subscribingToChannel = async (ctx) => {
    try {
        return await new Promise((res, rej) => {
            try {
                const channel = ctx?.pusher?.subscribe('private-hal')

                // TODO raise error in common
                channel.bind('pusher:subscription_succeeded', () => {
                    console.log('subscription succeded')

                    channel.unbind('pusher:subscription_succeeded')
                    res(channel)
                })
                channel.bind('pusher:subscription_error', (err) => {
                    channel.unbind('pusher:subscription_error')
                    console.log('subscription error!', err)
                    rej(err)
                })
            } catch (error) {
                console.log('subscription error catched', error)
                rej(error)
            }
        })
    } catch (err) {
        throw err
    } finally {
        ctx?.pusher.connection.unbind('error')
    }
}

// const disconnectPusher = async (ctx, event) => new Promise((res, rej) => {
//     setTimeout(res, 2000)
// })

// const createPusher = async (ctx) => new Promise((res, rej) => {
//     setTimeout(res, 2000)
// })

// const subscribingToChannel = async (ctx) => {
//     return new Promise((res, rej) => {
//         setTimeout(res, 2000)
//     })
// }

const CONNECTION_LIVES = 3

// const disconnecting = {
//     invoke: {
//         src: disconnectPusher,
//         onDone: 'creatingInstance',
//         onError: [
//             {
//                 target: '#initializing',
//                 actions: ['removeLive', 'handleErrorMessage'],
//                 cond: 'stillHaveLives',
//             },
//             {
//                 target: '#failed',
//                 actions: ['handleErrorMessage'],
//             },
//         ],
//     },
// }

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
            RESET: '.loading.disconnecting',
            // TODO shouldn't be in the final version of course
            SHOULD_FAIL_SWITCH: {
                actions: 'toggleShouldFail',
            },
            // TODO should it be only in failed state?
            RECONNECT: '.loading.reconnecting',
            OFFLINE: '.offline',
        },
        states: {
            idle: {
                id: 'idle',
                on: {
                    CONNECT: 'loading.creatingInstance',
                },
            },
            connected: {
                entry: 'resetLives',
                on: {
                    PUSHER_ERROR: [
                        {
                            target: 'loading.reconnecting',
                            actions: ['removeLive', 'handleErrorMessage'],
                            cond: 'stillHaveLives',
                        },
                        {
                            target: 'failed',
                            actions: ['handleErrorMessage'],
                        },
                    ],
                },
                id: 'connected',
                on: {
                    PUSHER_CONNECTING: 'loading.pusherLoading',
                    PUSHER_UNVAILABLE: 'loading.pusherLoading',
                    PUSHER_FAILED: [
                        {
                            target: 'loading.reconnecting',
                            actions: ['removeLive', 'handleErrorMessage'],
                            cond: 'stillHaveLives',
                        },
                        {
                            target: 'failed',
                            actions: ['handleErrorMessage'],
                        },
                    ],
                },
            },
            failed: {
                entry: 'resetLives',
                id: 'failed',
            },
            loading: {
                id: 'loading',
                // initial: 'creatingInstance',
                on: {
                    PUSHER_ERROR: [
                        {
                            target: '.reconnecting',
                            actions: ['removeLive', 'handleErrorMessage'],
                            cond: 'stillHaveLives',
                        },
                        {
                            target: '#failed',
                            actions: ['handleErrorMessage'],
                        },
                    ],
                },
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
                                    target: 'reconnecting',
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
                        id: 'subscribing',
                        type: 'final',
                        invoke: {
                            id: 'subscribingToChannel',
                            src: subscribingToChannel,
                            onDone: {
                                target: '#connected',
                                actions: ['setChannel'],
                            },
                            onError: [
                                {
                                    target: 'reconnecting',
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
                    pusherLoading: {
                        id: 'pusherLoading',
                        // TODO setTimeout for no events
                        on: {
                            PUSHER_CONNECTED: '#connected',
                            LOADING_TIMEOUT: '#failed',
                        },
                    },
                    reconnecting: {
                        id: 'reconnecting',
                        invoke: {
                            src: disconnectPusher,
                            onDone: {
                                target: 'creatingInstance',
                                actions: ['reset'],
                            },
                            onError: {
                                target: [
                                    {
                                        target: 'reconnecting',
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
                    disconnecting: {
                        invoke: {
                            src: disconnectPusher,
                            onDone: {
                                target: '#idle',
                                actions: ['reset'],
                            },
                            onError: {
                                actions: (_, e) => console.log(e.data),
                                target: '#failed',
                            },
                        },
                    },
                },
            },
            offline: {
                id: 'offline',
            },
        },
    },
    {
        guards: {
            stillHaveLives: (ctx) => {
                console.log('STILL HAVE LIVES?')
                return ctx.lives > 0
            },
        },
        actions: {
            reset: assign({
                pusher: () => null,
                channel: () => null,
                lastError: () => null,
                // shouldFail: () => false,
            }),
            setPusher: assign({
                pusher: (ctx, event) => event.data,
            }),
            setChannel: assign({
                channel: (ctx, event) => {
                    console.log('SETTING CHANNEL')
                    return event.data
                },
            }),
            handleErrorMessage: assign({
                lastError: (ctx, event) => {
                    console.log('HANDLING ERROR!', event.data)
                    return JSON.stringify(event.data)
                },
            }),
            removeLive: assign({
                lives: (ctx) => {
                    console.log(`removing live from ${ctx.lives}`)
                    return ctx.lives - 1
                },
            }),
            resetLives: assign({
                lives: (_) => CONNECTION_LIVES,
            }),
            toggleShouldFail: assign({
                shouldFail: (ctx, event) => event.value,
            }),
        },
    }
)
