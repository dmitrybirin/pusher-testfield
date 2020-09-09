import React, { useState, useEffect } from 'react'
import { View, Text } from 'react-native'
import Pusher from 'pusher-js/react-native'
import { useMachine } from '@xstate/react'
import { pusherMachine } from './machine'

Pusher.logToConsole = false

const getColor = (value) => {
    switch (value) {
        case 'idle':
            return '#222'
        case 'initializing':
            return 'blue'
        case 'offline':
            return '#aaa'
        case 'connected':
            return 'green'
        case 'failed':
            return 'red'
        default:
            return 'white'
    }
}

export const Beacon = () => {
    const [state, send] = useMachine(pusherMachine)
    const [message, setMessage] = useState('')
    const [timer, setTimer] = useState(0)

    useEffect(() => {
        console.log('executing effect', state.value)
        if (state.matches('connected')) {
            state?.context?.channel?.bind('activate', (data: string) => {
                setMessage(data)

                if (!timer) {
                    setTimer(setTimeout(() => setMessage(''), 2500))
                }
            })
        }
        return () => clearTimeout(timer)
    }, [state?.value])

    useEffect(() => {
        send('CONNECT')
    }, [])

    return (
        <View
            style={{
                width: 200,
                height: 200,
                borderRadius: 100,
                backgroundColor: getColor(state.value),
            }}
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
                    {message || state.context.lastError}
                </Text>
            </View>
        </View>
    )
}
