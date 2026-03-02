export default function CameraControls({ onStart, onStop, canStart, isRunning }) {
    return (
      <div className="mt-4 flex gap-3 justify-center">
        <button
          onClick={onStart}
          disabled={!canStart}
          className="px-4 py-2 bg-blue-500 rounded disabled:bg-gray-600 cursor-pointer"
        >
          Start Webcam
        </button>
        <button
          onClick={onStop}
          disabled={!isRunning}
          className="px-4 py-2 bg-blue-500 rounded disabled:bg-gray-600 cursor-pointer"
        >
          Stop Webcam
        </button>
      </div>
    );
  }