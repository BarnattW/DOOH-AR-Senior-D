import { useState, useEffect } from 'react';

// Mock coords near Empire State Building (passes isNearLandmark)
const MOCK_COORDS = {
    latitude: 40.748817,
    longitude: -73.985428,
    accuracy: 10,
    heading: null as number | null,
    speed: null as number | null,
};

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

export function useGeolocation(mockLocation = false) {
    const [state, setState] = useState<GeolocationState>({
        coords: null,
        error: null,
        loading: true,
    });

    useEffect(() => {
        if (mockLocation) {
            setState({
                coords: { ...MOCK_COORDS },
                error: null,
                loading: false,
            });
            return;
        }

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

        const errorHandler = (err: GeolocationPositionError) => {
            setState((s) => ({ ...s, loading: false, error: err.message }));
        };

        const options = {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 1000,
        };

        const watchId = navigator.geolocation.watchPosition(success, errorHandler, options);

        return () => navigator.geolocation.clearWatch(watchId);
    }, [mockLocation]);

    return state;
}
