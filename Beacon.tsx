import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Button, Switch } from 'react-native'
import Pusher from 'pusher-js/react-native'
import { useMachine } from '@xstate/react'
import { pusherMachine } from './machine'

Pusher.logToConsole = false

const getColor = (state) => {
    if (state.matches('initializing')) {
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
    if (state.matches('failed') || state.matches('initializing')) {
        return state.context.lives
    }

    return message
}

export const Beacon = () => {
    const [state, send] = useMachine(pusherMachine)
    const [message, setMessage] = useState('')
    const [timer, setTimer] = useState(0)

    useEffect(() => {
        // send('BIND', {
        //     name:'activate',
        //     handler: (data) =>
        // })
        if (state.matches('connected')) {
            state?.context?.channel?.bind('activate', (data: string) => {
                setMessage(data)
                if (!timer) {
                    setTimer(setTimeout(() => setMessage(''), 2500))
                }
            })

            state?.context?.pusher.connection.bind('failed', (err) => {
                send('FAILED', err)
            })
        }
        return () => {
            state?.context?.channel?.unbind('activate')
            clearTimeout(timer)
        }
    }, [state?.value])

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
                    marginBottom: 50
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
