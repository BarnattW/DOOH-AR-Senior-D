import { useState, useEffect } from 'react';

interface GeolocationState {
    coords: {
        latitude: number;
        longitude: number;
        accuracy: number;
        heading: number | null;
        speed: number | null;
    } | null;
    error: string | null;
    loading: boolean;
}

export function useGeolocation() {
    const [state, setState] = useState<GeolocationState>({
        coords: null,
        error: null,
        loading: true,
    });

    useEffect(() => {
        if (!('geolocation' in navigator)) {
            setState((s) => ({ ...s, loading: false, error: 'Geolocation not supported' }));
            return;
        }

        const success = (position: GeolocationPosition) => {
            setState({
                coords: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                },
                error: null,
                loading: false,
            });
        };

        const error = (error: GeolocationPositionError) => {
            setState((s) => ({ ...s, loading: false, error: error.message }));
        };

        const options = {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 1000,
        };

        const watchId = navigator.geolocation.watchPosition(success, error, options);

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    return state;
}
