import React, { useState, useEffect } from 'react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

export default function CurrencyInput({ value, onChange, className = '', placeholder = '', required = false }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (value === 0) {
      if (displayValue !== '') setDisplayValue('');
      return;
    }
    setDisplayValue(new Intl.NumberFormat('id-ID').format(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (rawValue === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }
    const numValue = parseInt(rawValue, 10);
    setDisplayValue(new Intl.NumberFormat('id-ID').format(numValue));
    onChange(numValue);
  };

  return (
    <div className="relative">
      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 font-medium">Rp</span>
      <input
        type="text"
        inputMode="numeric"
        className={`w-full pl-10 pr-3 py-2 border rounded-xl outline-none focus:ring-2 focus:border-transparent transition-all focus:ring-primary-purple/30 ${className}`}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
