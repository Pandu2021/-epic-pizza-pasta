import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="text-center py-16">
      <h1 className="text-4xl font-extrabold">404</h1>
      <p className="mt-2 text-slate-600">Page not found</p>
      <div className="mt-6">
        <Link to="/" className="btn-primary">Go Home</Link>
      </div>
    </section>
  );
}
