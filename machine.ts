// @ts-nocheck
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
                enabledTransports: ['ws', 'wss'],
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

const subscribingToChannel = async (ctx) => {
    const channel = ctx?.pusher?.subscribe('hal')

    return new Promise((res, rej) => {
        channel.bind('pusher:subscription_succeeded', () => res(channel))
        channel.bind('pusher:subscription_error', (err) => rej(err))
    })
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

const creatingInstance = {
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
                actions: ['removeLive', 'handleErrorMessage'],
                cond: 'stillHaveLives',
            },
            {
                target: '#failed',
                actions: ['handleErrorMessage'],
            },
        ],
    },
}

const subscribing = {
    type: 'final',
    invoke: {
        id: 'subscribingToChannel',
        src: subscribingToChannel,
        onDone: {
            target: '#connected',
            actions: ['setChannel', 'resetLives'],
        },
        onError: [
            {
                target: 'subscribing',
                actions: ['removeLive', 'handleErrorMessage'],
                cond: 'stillHaveLives',
            },
            {
                target: '#failed',
                actions: ['handleErrorMessage'],
            },
        ],
    },
}

const disconnecting = {
    invoke: {
        src: disconnectPusher,
        onDone: 'creatingInstance',
        onError: [
            {
                target: '#initializing',
                actions: ['removeLive', 'handleErrorMessage'],
                cond: 'stillHaveLives',
            },
            {
                target: '#failed',
                actions: ['handleErrorMessage'],
            },
        ],
    },
}
 
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
            RESET: 'disconnecting',
            // TODO shouldn't be in the final version of course
            SHOULD_FAIL_SWITCH: {
                actions: 'toggleShouldFail',
            },

            PUSHER_FAILED: {
                target: '#reconnecting',
                actions: 'handleErrorMessage',
            },
            // TODO should it be only in failed state?
            RECONNECT: '#reconnecting',
            OFFLINE: '#offline',
        },
        states: {
            idle: {
                id: 'idle',
                on: {
                    CONNECT: 'initializing',
                },
            },
            connected: {
                id: 'connected',
                on: {
                    PUSHER_CONNECTING: 'pusherLoading',
                    PUSHER_UNVAILABLE: 'pusherLoading',
                },
            },
            initializing: {
                id: 'initializing',
                initial: 'creatingInstance',
                states: {
                    creatingInstance,
                    subscribing,
                },
            },
            reconnecting: {
                id: 'reconnecting',
                initial: 'disconnecting',
                states: {
                    disconnecting,
                    creatingInstance,
                    subscribing,
                },
            },
            pusherLoading: {
                // TODO setTimeout for no events
                on: {
                    PUSHER_CONNECTED: 'connected',
                    LOADING_TIMEOUT: 'failed',
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
            stillHaveLives: (ctx) => ctx.lives >= 0,
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
        },
    }
)
