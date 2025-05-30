import { describe, it, expect } from 'vitest';
import { Form, FormField, FormFieldGroup } from '../src/form/Form';
import { left, right } from '@sweet-monads/either';

describe('README Examples', () => {
	describe('Basic Usage', () => {
		const notEmpty = (value: string) =>
			value.length > 0
				? right(value)
				: left({ message: 'Field cannot be empty' });

		const isAdult = (age: number) =>
			age >= 18 ? right(age) : left({ message: 'Must be 18 or older' });

		it('should demonstrate basic form usage', () => {
			const userForm = new Form({
				name: new FormField('John', notEmpty),
				age: new FormField(25, isAdult),
				email: new FormField('john@example.com'),
			});

			const name = userForm.getValueByPath('name');
			expect(name).toBe('John');

			const updatedForm = userForm.setValueByPath('name', 'Jane');
			expect(updatedForm.getValueByPath('name')).toBe('Jane');

			const validationResult = updatedForm.validateForm();
			expect(validationResult.isRight()).toBe(true);
		});
	});

	describe('Group-Level Validation', () => {
		const notEmpty = (value: string) =>
			value.length > 0
				? right(value)
				: left({ message: 'Field cannot be empty' });

		const passwordsMatch = (group: {
			password: FormField<string>;
			confirmPassword: FormField<string>;
		}) => {
			const password = group.password.getValue();
			const confirmPassword = group.confirmPassword.getValue();

			return password === confirmPassword
				? right(group)
				: left({ message: 'Passwords must match' });
		};

		const validateUSAddress = (group: {
			street: FormField<string>;
			country: FormField<string>;
			zipCode: FormField<string>;
			city: FormField<string>;
		}) => {
			const country = group.country.getValue();
			const zipCode = group.zipCode.getValue();

			if (country === 'US' && zipCode.length === 0) {
				return left({
					message: 'ZIP code is required for US addresses',
				});
			}

			return right(group);
		};

		it('should validate password group', () => {
			const registrationForm = new Form({
				username: new FormField('john_doe', notEmpty),
				security: new FormFieldGroup(
					{
						password: new FormField('password123', notEmpty),
						confirmPassword: new FormField('password123', notEmpty),
					},
					passwordsMatch
				),
			});

			const result = registrationForm.validateForm();
			expect(result.isRight()).toBe(true);
		});

		it('should fail when passwords do not match', () => {
			const registrationForm = new Form({
				username: new FormField('john_doe', notEmpty),
				security: new FormFieldGroup(
					{
						password: new FormField('password123', notEmpty),
						confirmPassword: new FormField('different', notEmpty),
					},
					passwordsMatch
				),
			});

			const result = registrationForm.validateForm();
			expect(result.isLeft()).toBe(true);
			result.mapLeft((error) => {
				expect(error.message).toBe('Passwords must match');
			});
		});

		it('should validate US address with ZIP code', () => {
			const addressForm = new Form({
				address: new FormFieldGroup(
					{
						street: new FormField('123 Main St', notEmpty),
						city: new FormField('New York', notEmpty),
						country: new FormField('US'),
						zipCode: new FormField('10001'),
					},
					validateUSAddress
				),
			});

			const result = addressForm.validateForm();
			expect(result.isRight()).toBe(true);
		});
	});

	describe('Nested Form Structure', () => {
		it('should handle deeply nested form structures', () => {
			const form = new Form({
				user: new FormFieldGroup({
					name: new FormField('John'),
					profile: new FormFieldGroup({
						bio: new FormField('Developer'),
						settings: new FormFieldGroup({
							theme: new FormField('dark'),
						}),
					}),
				}),
			});

			expect(form.getValueByPath('user.name')).toBe('John');
			expect(form.getValueByPath('user.profile.bio')).toBe('Developer');
			expect(form.getValueByPath('user.profile.settings.theme')).toBe(
				'dark'
			);

			const updated = form
				.setValueByPath('user.name', 'Jane')
				.setValueByPath('user.profile.settings.theme', 'light');

			expect(updated.getValueByPath('user.name')).toBe('Jane');
			expect(updated.getValueByPath('user.profile.settings.theme')).toBe(
				'light'
			);
		});
	});

	describe('Path Operations', () => {
		it('should handle type-safe path operations', () => {
			const form = new Form({
				user: new FormFieldGroup({
					personal: new FormFieldGroup({
						name: new FormField('John'),
						age: new FormField(25),
					}),
					contact: new FormFieldGroup({
						email: new FormField('john@example.com'),
					}),
				}),
				preferences: new FormFieldGroup({
					theme: new FormField('dark'),
				}),
			});

			const updated = form
				.setValueByPath('user.personal.name', 'Jane')
				.setValueByPath('user.contact.email', 'jane@example.com')
				.setValueByPath('preferences.theme', 'light');

			expect(updated.getValueByPath('user.personal.name')).toBe('Jane');
			expect(updated.getValueByPath('user.contact.email')).toBe(
				'jane@example.com'
			);
			expect(updated.getValueByPath('preferences.theme')).toBe('light');
		});
	});
});
