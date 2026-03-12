import React from 'react';
import TicketForm from '../components/TicketForm';

const Home = () => {
    return (
        <main className="max-w-5xl mx-auto px-4 py-12">
            {/* Hero Title */}
            <div className="text-center mb-10">
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white sm:text-4xl mb-3">
                    Raise a Support Ticket
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-lg">
                    Fill out the form below and our team will get back to you shortly.
                </p>
            </div>

            <TicketForm />
        </main>
    );
};

export default Home;
