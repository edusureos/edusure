import { useId, useState } from 'react';
import { ChevronDown, Phone } from 'lucide-react';
import './contact-us.css';

const CONTACTS = [
  { name: 'Prince Sir', number: '7310680106' },
  { name: 'Anushka Mam', number: '9891238277' },
];

export default function ContactUs({ variant = 'student', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={`contact-us contact-us-${variant} ${className}${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        className="contact-us-toggle"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Phone className="contact-us-icon" size={14} aria-hidden="true" />
        <span className="contact-us-label">Contact Us</span>
        <ChevronDown className="contact-us-chevron" size={14} aria-hidden="true" />
      </button>
      <div className="contact-us-panel" id={panelId} hidden={!isOpen}>
        {CONTACTS.map(({ name, number }) => (
          <a className="contact-us-person" href={`tel:${number}`} key={number}>
            <span className="contact-us-name">{name}</span>
            <span className="contact-us-number">{number}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
