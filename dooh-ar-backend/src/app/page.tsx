'use client';

import { useState, useEffect } from 'react';
import { useGeolocation } from '@/hooks/useGeolocation';

export default function Home() {
    const { coords, error, loading } = useGeolocation();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <main style={{ minHeight: '100vh', padding: '2rem', fontFamily: 'monospace', backgroundColor: 'white', color: 'black' }}>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '2rem' }}>Geolocation Stats</h1>

            {loading && (
                <div style={{ padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '0.25rem' }}>
                    Loading location data...
                </div>
            )}

            {error && (
                <div style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '0.25rem', marginBottom: '1rem' }}>
                    Error: {error}
                </div>
            )}

            {coords && (
                <div style={{ display: 'grid', gap: '1rem', maxWidth: '28rem' }}>
                    <StatItem label="Latitude" value={coords.latitude.toFixed(6)} />
                    <StatItem label="Longitude" value={coords.longitude.toFixed(6)} />
                    <StatItem label="Accuracy" value={`±${Math.round(coords.accuracy)}m`} />
                    <StatItem
                        label="Heading"
                        value={coords.heading !== null ? `${coords.heading.toFixed(1)}°` : 'N/A'}
                    />
                    <StatItem
                        label="Speed"
                        value={coords.speed !== null ? `${(coords.speed * 3.6).toFixed(1)} km/h` : '0 km/h'}
                    />
                </div>
            )}

            {!loading && !error && !coords && (
                <div style={{ padding: '1rem', backgroundColor: '#fefce8', color: '#854d0e', borderRadius: '0.25rem' }}>
                    Waiting for permissions...
                </div>
            )}
        </main>
    );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
            <span style={{ fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', fontSize: '0.875rem' }}>{label}</span>
            <span style={{ fontWeight: 'bold' }}>{value}</span>
        </div>
    );
}
