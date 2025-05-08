import { Navigation } from "./Navigation";

export default function Sidebar() {
  return (
    <div className="hidden border-r bg-background lg:block w-64 h-[calc(100vh-4rem)]">
      <div className="space-y-4 py-4">
        <div className="px-4 py-2">
         
          <div className="space-y-1">
            <Navigation className="flex flex-col" />
          </div>
        </div>
      </div>
    </div>
  );
}
