import React from 'react';
import Header from './Header';
import { Link } from 'react-router-dom';

const About = () => {
  return (
    <div className="bg-white text-gray-800">
      <Header />

      {/* Hero Section */}
      <section className="text-center py-20 bg-gradient-to-br from-purple-100 via-white to-blue-100 px-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 text-gray-900">
          About <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-500">JAI JCS</span>
        </h1>
        <p className="text-lg max-w-3xl mx-auto text-gray-700">
          JAI JCS is an advanced generative AI solution that revolutionizes how individuals and businesses interact with data, automate tasks, and boost productivity.
        </p>
      </section>

      {/* Mission & Vision */}
      <section className="py-16 px-6 md:px-20 bg-white">
        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <h2 className="text-3xl font-semibold mb-4 text-purple-700">Our Vision</h2>
            <p className="text-gray-700 leading-relaxed">
              To empower people through intelligent solutions that simplify decision-making, encourage innovation, and support future-ready businesses.
            </p>
          </div>
          <div>
            <h2 className="text-3xl font-semibold mb-4 text-purple-700">Our Mission</h2>
            <p className="text-gray-700 leading-relaxed">
              To deliver accessible, intuitive, and intelligent AI experiences that understand user intent and make complex processes seamless and efficient.
            </p>
          </div>
        </div>
      </section>

      {/* Why Choose JAI JCS */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800">Why Choose JAI JCS?</h2>
          <p className="text-gray-600 mt-2 max-w-2xl mx-auto">
            Discover a smarter way to work with AI that's built for real-world results.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {[
            { title: "Generative Power", text: "Create content, generate code, and automate documents based on your unique needs." },
            { title: "Real-Time Insights", text: "Gain meaningful insights instantly from your data, text, and user interactions." },
            { title: "Seamless Integration", text: "Easily connects with your existing tools, APIs, and workflows." },
            { title: "Human-Centric Design", text: "User-first interface that adapts naturally to your goals and behavior." },
            { title: "Privacy & Security", text: "Enterprise-grade encryption and user privacy at the core of everything we build." },
            { title: "AI That Grows", text: "Our system evolves with your feedback, ensuring continual improvement and innovation." },
          ].map((item, index) => (
            <div key={index} className="bg-white shadow-md p-6 rounded-xl hover:shadow-lg transition">
              <h3 className="text-xl font-semibold mb-2 text-purple-700">{item.title}</h3>
              <p className="text-gray-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800">What Our Users Say</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {[
            {
              feedback:
                "JAI JCS completely transformed our reporting process. It's a must-have for any data-driven team.",
              name: "Alex - Analyst",
            },
            {
              feedback:
                "As a student, it’s like having a personal assistant for coding, summarizing, and research tasks.",
              name: "Meena - Computer Science Student",
            },
            {
              feedback:
                "From setup to integration, the experience was seamless. It’s made our operations smarter and quicker.",
              name: "Rahul - Startup Founder",
            },
          ].map((user, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
              <p className="text-gray-700 italic">"{user.feedback}"</p>
              <div className="mt-4 text-sm text-purple-600 font-semibold">— {user.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white text-center px-6">
        <h2 className="text-4xl font-bold mb-4 text-gray-800">Ready to Experience the Power of JAI JCS?</h2>
        <p className="max-w-xl mx-auto mb-6 text-lg text-gray-600">
          Start your journey today with AI that understands your goals and simplifies your workflow.
        </p>
        <Link
          to="/"
          className="bg-gradient-to-r from-purple-600 to-blue-500 text-white font-semibold px-6 py-3 rounded-full shadow hover:shadow-lg transition"
        >
          Get Started
        </Link>
      </section>
    </div>
  );
};

export default About;