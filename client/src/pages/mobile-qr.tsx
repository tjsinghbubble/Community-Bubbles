const EXPO_URL = "exp://163cfc20-e221-41ad-b2c3-67afe2df4e33-00-15yrg27byh3aa.spock.replit.dev:8080";
const QR_API = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(EXPO_URL)}`;

export default function MobileQR() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-3xl shadow-lg p-8 max-w-sm w-full flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl font-bold text-[#1E1F26]">Open on Your Phone</h1>
          <p className="text-sm text-gray-500 text-center">
            Scan with your iPhone camera app or the Expo Go app on Android
          </p>
        </div>

        <img
          src={QR_API}
          alt="Expo QR Code"
          width={280}
          height={280}
          className="rounded-xl"
        />

        <div className="w-full bg-[#FAFAFA] rounded-xl p-3 flex flex-col gap-1">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Permanent URL</p>
          <p className="text-xs text-[#35A8F7] font-mono break-all">{EXPO_URL}</p>
        </div>

        <div className="flex flex-col gap-2 w-full text-sm text-gray-500">
          <div className="flex items-start gap-2">
            <span className="text-[#35A8F7] font-bold mt-0.5">1</span>
            <span>Scan the QR code above with your camera app</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#35A8F7] font-bold mt-0.5">2</span>
            <span>Tap the notification to open in Expo Go</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#35A8F7] font-bold mt-0.5">3</span>
            <span>This QR code never changes — bookmark this page</span>
          </div>
        </div>
      </div>
    </div>
  );
}
