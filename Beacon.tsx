import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native'
import Pusher from 'pusher-js/react-native';
import { useMachine } from '@xstate/react'
import { pusheenMachine } from './machine'

Pusher.logToConsole = true;

const pusher = new Pusher('04fc1f9a59013ef0cbd5', {
    cluster: 'eu'
});

const channel = pusher.subscribe('hal');


const getColor = (value) => {
    switch (value) {
        case 'idle':
            return '#222'
        case 'loading':
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
    const [state, send, service] = useMachine(pusheenMachine)
    const [message, setMessage] = useState('')
    const [timer, setTimer] = useState(0)


    useEffect(() => {
        state?.context?.channel?.bind('activate', (data) => {
            console.log('dDTATDTATDTATDTADTTADTA', data)
            setMessage(data)
            // if (!timer) {
            //     setTimer(setTimeout(() => setMessage(''), 2500))
            // }
        });
        // return () => clearTimeout(timer)
    }, [state?.context?.channel])

    useEffect(() => {
        send('CONNECT')
    }, [])


    return <View style={{
        width: 200, height: 200, borderRadius: 100, backgroundColor: getColor(state.value)
    }}><View style={{
        flex: 1, alignItems: 'center',
        justifyContent: 'center'
    }}><Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase' }}>{message || state.context.lastError}</Text></View></View>
}