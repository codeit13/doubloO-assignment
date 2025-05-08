import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">404</h1>
        <h2 className="mt-2 text-2xl font-semibold">Page not found</h2>
        <p className="mt-4 text-muted-foreground">
          Sorry, we couldn't find the page you're looking for.
        </p>
        <div className="mt-6">
          <Link to="/">
            <Button>Go back home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
