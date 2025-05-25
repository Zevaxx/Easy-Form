import { describe, it, expect } from 'vitest';
import { left, right } from '@sweet-monads/either';
import { Form, FormField, FormFieldGroup } from '../assets/form/Form';

describe('Form Validation', () => {
	// Simple field validator
	const notEmptyValidator = (value: string) =>
		value.length > 0
			? right(value)
			: left({ message: 'Field cannot be empty' });

	// Basic form setup
	const createBasicForm = () => {
		const nameField = new FormField('', notEmptyValidator);
		return new Form({ name: nameField }, () => right({ name: nameField }));
	};

	it('should create a form with fields', () => {
		const form = createBasicForm();
		expect(form.getForm()).toBeTruthy();
	});

	it('should validate empty field and return error', () => {
		const form = createBasicForm();
		const result = form.validateForm();
		expect(result.isLeft()).toBe(true);
	});

	it('should validate field with valid input', () => {
		const form = createBasicForm();
		const updatedForm = form.setFieldValue('name', 'John');
		const result = updatedForm.validateForm();
		expect(result.isRight()).toBe(true);
	});

	it('should handle field value updates', () => {
		const form = createBasicForm();
		const updatedForm = form.setFieldValue('name', 'John');
		expect(updatedForm.getForm().name.getValue()).toBe('John');
	});

	describe('FormFieldGroup', () => {
		const createGroupForm = () => {
			return new Form({
				address: new FormFieldGroup({
					street: new FormField('', notEmptyValidator),
					city: new FormField('', notEmptyValidator),
				}),
			});
		};

		it('should validate nested form group', () => {
			const form = createGroupForm();
			const result = form.validateForm();
			expect(result.isLeft()).toBe(true);
		});

		it('should validate form group with valid inputs', () => {
			let form = createGroupForm()
				.setValueByPath('address.street', '123 Main St')
				.setValueByPath('address.city', 'New York');
			const result = form.validateForm();
			expect(result.isRight()).toBe(true);
		});
	});

	describe('Complex Validation', () => {
		const matchingFieldsValidator = (fields: any) =>
			fields.password.getValue() === fields.confirmPassword.getValue()
				? right(fields)
				: left({ message: 'Passwords do not match' });

		const createPasswordForm = () => {
			const form = new Form(
				{
					password: new FormField('', notEmptyValidator),
					confirmPassword: new FormField('', notEmptyValidator),
				},
				matchingFieldsValidator
			);
			return form;
		};

		it('should validate matching passwords', () => {
			let form = createPasswordForm()
				.setFieldValue('password', 'secret')
				.setFieldValue('confirmPassword', 'secret');
			const result = form.validateForm();
			expect(result.isRight()).toBe(true);
		});

		it('should fail validation for non-matching passwords', () => {
			let form = createPasswordForm()
				.setFieldValue('password', 'secret1')
				.setFieldValue('confirmPassword', 'secret2');
			const result = form.validateForm();
			expect(result.isLeft()).toBe(true);
		});
	});

	describe('Validate some complex validation with objects and arrays', () => {
		const createComplexForm = () => {
			return new Form(
				{
					name: new FormField('', notEmptyValidator),
					items: new FormFieldGroup(
						{
							item1: new FormField('', notEmptyValidator),
							item2: new FormField(''),
						},
						(fields) => {
							if (Object.keys(fields).length === 0) {
								return left({
									message: 'At least one item is required',
								});
							}
							return right(fields);
						}
					),
				},
				(fields) => {
					if (Object.keys(fields.items.getFields()).length === 0) {
						return left({
							message: 'At least one item is required',
						});
					}
					return right(fields);
				}
			);
		};

		it('should validate complex form with nested fields', () => {
			const form = createComplexForm();
			const result = form.validateForm();
			expect(result.isLeft()).toBe(true);
		});

		it('should validate complex form with valid inputs', () => {
			const form = createComplexForm()
				.setFieldValue('name', 'Test')
				.setValueByPath('items.item1', 'Item 1');
			const result = form.validateForm();
			expect(result.isRight()).toBe(true);
		});

		it('should fail validation if no items are provided', () => {
			const form = createComplexForm().setFieldValue('name', 'Test');
			const result = form.validateForm();
			expect(result.isLeft()).toBe(true);
		});
	});
});
