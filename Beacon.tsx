import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Button, Switch } from 'react-native'
import Pusher from 'pusher-js/react-native'
import { useMachine } from '@xstate/react'
import { useMachineFR } from './useMachineFR'
import { pusherMachine } from './machine'

Pusher.logToConsole = false

const getColor = (state) => {
    if (
        state.matches('initializing') ||
        state.matches('reconnecting') ||
        state.matches('pusherLoading')
    ) {
        return 'blue'
    }
    if (state.matches('idle')) {
        return '#222'
    }

    if (state.matches('offline')) {
        return '#aaa'
    }

    if (state.matches('connected')) {
        return 'green'
    }

    if (state.matches('failed')) {
        return 'red'
    }

    return 'white'
}

const getMessage = (state, message) => {
    if (
        state.matches('initializing') ||
        state.matches('reconnecting') ||
        state.matches('loading')
    ) {
        if (typeof state.value === 'string') {
            return `${state.value}\n${state.context.lives}`
        } else {
            return Object.entries(state.value)
                .map(
                    ([key, value]) => `${key}\n${value}\n${state.context.lives}`
                )
                .join('.')
        }
    }

    if (state.matches('failed') || state.matches('initializing')) {
        return state.context.lives
    }

    return message
}

export const Beacon = () => {
    const [state, send] = useMachineFR(pusherMachine)
    const [message, setMessage] = useState('')
    const [timer, setTimer] = useState(0)
    console.log({ message })
    useEffect(() => {
        if (state?.context?.pusher?.connection?.socket_id) {
            state?.context?.pusher?.connection.bind(
                'state_change',
                (states) => {
                    switch (states.current) {
                        case 'connecting':
                            send('PUSHER_CONNECTING')
                            break
                        case 'connected':
                            send('PUSHER_CONNECTED')
                            break
                        case 'unavailable':
                            send('PUSHER_UNAVAILABLE')
                            break
                        case 'failed':
                            send('PUSHER_FAILED')
                            break
                        default:
                            break
                    }
                }
            )
            // setTimeout(() => send('PUSHER_ERROR', { error: 'foo' }), 2000)

            state?.context?.pusher?.connection.bind('error', (error) => {
                console.log('pusher error', +new Date(), error)
                const code =
                    error?.data?.code || error?.error?.data?.code || error?.code

                if (code && code >= 4000 && code <= 4099) {
                    console.log('URECOVERABLE!')
                    send('PUSHER_ERROR', { error })
                }
            })
        }
        return () => {
            state?.context?.pusher?.connection?.unbind('error')
            state?.context?.pusher?.connection?.unbind('state_change')
            clearTimeout(timer)
        }
    }, [state?.context?.pusher?.connection?.socket_id])

    useEffect(() => {
        state?.context?.channel?.bind('activate', (data: string) => {
            console.log({ data })
            setMessage(data)
            if (timer) {
                clearTimeout(timer)
            }

            setTimer(
                setTimeout(() => {
                    setMessage('')
                    setTimer(0)
                }, 2500)
            )
        })
        return () => {
            state?.context?.channel?.unbind('activate')
            clearTimeout(timer)
        }
    }, [state.context.channel, timer])

    useEffect(() => {
        send('CONNECT')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <View
            style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <View
                style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderColor: 'red',
                    borderWidth: 2,
                    marginBottom: 50,
                }}
            >
                <View
                    style={{
                        width: 150,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderColor: 'red',
                        borderBottomWidth: 2,
                        padding: 10,
                    }}
                >
                    <Text style={{ color: 'red' }}>Should Fail</Text>
                    <Switch
                        trackColor={{ false: 'green', true: 'red' }}
                        value={state?.context?.shouldFail}
                        onValueChange={(value) =>
                            send('SHOULD_FAIL_SWITCH', { value })
                        }
                    />
                </View>
                <Button
                    title="RESET"
                    color="red"
                    onPress={() => send('RESET')}
                />
                <Text
                    style={{ color: 'red' }}
                >{`Error: ${state?.context?.lastError}`}</Text>
            </View>
            <TouchableOpacity
                style={{
                    width: 200,
                    height: 200,
                    borderRadius: 100,
                    backgroundColor: getColor(state),
                }}
                onPress={() => send('RECONNECT')}
            >
                <View
                    style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Text
                        style={{
                            color: 'white',
                            fontSize: 20,
                            fontWeight: 'bold',
                            textAlign: 'center',
                            textTransform: 'uppercase',
                        }}
                    >
                        {getMessage(state, message)}
                    </Text>
                </View>
            </TouchableOpacity>
        </View>
    )
}
