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



// Create a form with nested structure
const form = new Form({
  user: new FormFieldGroup({
    name: new FormField('John', notEmpty),
    profile: new FormFieldGroup({
      bio: new FormField('Developer'),
      settings: new FormFieldGroup({
        theme: new FormField('dark')
      })
    })
  })
});

// Get values using type-safe paths
const name = form.getValueByPath('user.name');
const theme = form.getValueByPath('user.profile.settings.theme');

// Update values using type-safe paths
const updatedForm = form.setValueByPath('user.name', 'Jane');

// Validate the entire form
const result = form.validateForm();
```

## API Reference

### FormField

Basic form field that holds a single value with optional validators:

```typescript
const nameField = new FormField('John', notEmpty);
const ageField = new FormField(25, isAdult);
```

### FormFieldGroup

Groups related fields with optional group-level validation:

```typescript
const userGroup = new FormFieldGroup({
  name: new FormField('John'),
  address: new FormFieldGroup({
    street: new FormField('123 Main St')
  })
});
```

### Form

Top-level form container with form-wide validation:

```typescript
const form = new Form({
  user: new FormFieldGroup({
    name: new FormField('John'),
    age: new FormField(25)
  })
});
```

### Path-based Operations

Access and update nested values using type-safe paths:

```typescript
// Get values
const name = form.getValueByPath('user.name');
const age = form.getValueByPath('user.age');

// Update values
const updated = form.setValueByPath('user.name', 'Jane');
```

## Type Safety

The library provides complete type inference for:
- Form structure
- Field values
- Validation results
- Path strings
- Update operations

All operations maintain type safety through the entire form hierarchy.