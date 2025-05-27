# Type-Safe Form Validation Library

A strongly-typed TypeScript form validation library that provides nested form structures with composable validation rules.

## Features

- 🔒 Full TypeScript support with deep type inference
- 🎯 Composable validation rules
- 📝 Nested form structures
- 🌳 Path-based value access and updates
- 🛡️ Immutable data structures
- ⚡ Monadic validation using `@sweet-monads/either`
- 🧪 Comprehensive test coverage

## Installation

```bash
TBC
```

## Basic Usage

```typescript
import { Form, FormField, FormFieldGroup } from './form';
import { left, right } from '@sweet-monads/either';

// Define validators
const notEmpty = (value: string) => 
  value.length > 0 
    ? right(value) 
    : left({ message: 'Field cannot be empty' });

const isAdult = (value: number) =>
  value >= 18
    ? right(value)
    : left({ message: 'Must be 18 or older' });

// Create a form with nested structure
const userForm = new Form({
  name: new FormField('', notEmpty),
  age: new FormField(25, isAdult),
  address: new FormFieldGroup({
    street: new FormField('', notEmpty),
    city: new FormField('', notEmpty)
  })
});

// Update values using type-safe paths
const updatedForm = userForm
  .setValueByPath('name', 'John')
  .setValueByPath('address.street', '123 Main St');

// Validate the entire form
const result = updatedForm.validateForm();
```

## API Reference

### FormField

Basic form field that holds a single value with optional validators:

```typescript
const nameField = new FormField('', notEmpty);
const ageField = new FormField(25, isAdult);
```

### FormFieldGroup

Groups related fields with optional group-level validation:

```typescript
const addressGroup = new FormFieldGroup({
  street: new FormField(''),
  city: new FormField('')
}, validateAddressGroup);
```

### Form

Top-level form container with form-wide validation:

```typescript
const form = new Form({
  user: new FormFieldGroup({
    name: new FormField(''),
    email: new FormField('')
  })
}, validateUserForm);
```

### Path-based Operations

Access and update nested values using type-safe paths:

```typescript
// Get values
const name = form.getValueByPath('user.name');
const email = form.getValueByPath('user.email');

// Update values
const updated = form
  .setValueByPath('user.name', 'John')
  .setValueByPath('user.email', 'john@example.com');
```

## Type Safety

The library provides complete type inference for:
- Form structure
- Field values
- Validation results
- Path strings
- Update operations
