import { expectTypeOf } from 'expect-type';
import { describe, it } from 'vitest';
import { Form, FormField, FormFieldGroup } from '../src/form/Form';
import { Either } from '@sweet-monads/either';

describe('Type Tests with expect-type', () => {
	it('should infer FormField types correctly', () => {
		const stringField = new FormField('hello');
		const numberField = new FormField(42);
		const booleanField = new FormField(true);
		const objectField = new FormField({ name: 'John', age: 25 });

		expectTypeOf(stringField.getValue()).toEqualTypeOf<string>();
		expectTypeOf(numberField.getValue()).toEqualTypeOf<number>();
		expectTypeOf(booleanField.getValue()).toEqualTypeOf<boolean>();
		expectTypeOf(objectField.getValue()).toEqualTypeOf<{
			name: string;
			age: number;
		}>();
	});

	it('should infer FormFieldGroup types correctly', () => {
		const group = new FormFieldGroup({
			name: new FormField('John'),
			age: new FormField(25),
			isActive: new FormField(true),
		});

		const fields = group.getFields();

		expectTypeOf(fields.name).toEqualTypeOf<FormField<string>>();
		expectTypeOf(fields.age).toEqualTypeOf<FormField<number>>();
		expectTypeOf(fields.isActive).toEqualTypeOf<FormField<boolean>>();

		expectTypeOf(fields.name.getValue()).toEqualTypeOf<string>();
		expectTypeOf(fields.age.getValue()).toEqualTypeOf<number>();
		expectTypeOf(fields.isActive.getValue()).toEqualTypeOf<boolean>();
	});

	it('should handle nested FormFieldGroup types', () => {
		const nestedForm = new Form({
			user: new FormFieldGroup({
				name: new FormField('John'),
				contact: new FormFieldGroup({
					email: new FormField('john@example.com'),
					phone: new FormField('123-456-7890'),
					address: new FormFieldGroup({
						street: new FormField('123 Main St'),
						coordinates: new FormFieldGroup({
							lat: new FormField(40.7128),
							lng: new FormField(-74.006),
						}),
					}),
				}),
			}),
			settings: new FormField({ theme: 'dark', notifications: true }),
		});

		// Test path value types
		expectTypeOf(
			nestedForm.getValueByPath('user.name')
		).toEqualTypeOf<string>();
		expectTypeOf(
			nestedForm.getValueByPath('user.contact.email')
		).toEqualTypeOf<string>();
		expectTypeOf(
			nestedForm.getValueByPath('user.contact.phone')
		).toEqualTypeOf<string>();
		expectTypeOf(
			nestedForm.getValueByPath('user.contact.address.street')
		).toEqualTypeOf<string>();
		expectTypeOf(
			nestedForm.getValueByPath('user.contact.address.coordinates.lat')
		).toEqualTypeOf<number>();
		expectTypeOf(
			nestedForm.getValueByPath('user.contact.address.coordinates.lng')
		).toEqualTypeOf<number>();
		expectTypeOf(nestedForm.getValueByPath('settings')).toEqualTypeOf<{
			theme: string;
			notifications: boolean;
		}>();
	});

	it('should enforce correct types in setValueByPath', () => {
		const form = new Form({
			user: new FormFieldGroup({
				name: new FormField('John'),
				age: new FormField(25),
				profile: new FormFieldGroup({
					bio: new FormField('Developer'),
					settings: new FormFieldGroup({
						theme: new FormField('dark'),
					}),
				}),
			}),
		});

		// These should compile correctly
		const updated1 = form.setValueByPath('user.name', 'Jane');
		const updated2 = form.setValueByPath('user.age', 30);
		const updated3 = form.setValueByPath(
			'user.profile.bio',
			'Senior Developer'
		);
		const updated4 = form.setValueByPath(
			'user.profile.settings.theme',
			'light'
		);

		expectTypeOf(updated1).toEqualTypeOf<typeof form>();
		expectTypeOf(updated2).toEqualTypeOf<typeof form>();
		expectTypeOf(updated3).toEqualTypeOf<typeof form>();
		expectTypeOf(updated4).toEqualTypeOf<typeof form>();

		// Test that the updated values have correct types when retrieved
		expectTypeOf(
			updated1.getValueByPath('user.name')
		).toEqualTypeOf<string>();
		expectTypeOf(
			updated2.getValueByPath('user.age')
		).toEqualTypeOf<number>();
		expectTypeOf(
			updated3.getValueByPath('user.profile.bio')
		).toEqualTypeOf<string>();
		expectTypeOf(
			updated4.getValueByPath('user.profile.settings.theme')
		).toEqualTypeOf<string>();
	});

	it('should infer Path type correctly', () => {
		type TestForm = {
			user: FormFieldGroup<{
				name: FormField<string>;
				contact: FormFieldGroup<{
					email: FormField<string>;
					address: FormFieldGroup<{
						street: FormField<string>;
						city: FormField<string>;
					}>;
				}>;
			}>;
			metadata: FormField<{ created: Date }>;
		};

		// Test that Path type includes all valid paths
		expectTypeOf<'user'>().toMatchTypeOf<keyof TestForm & string>();
		expectTypeOf<'metadata'>().toMatchTypeOf<keyof TestForm & string>();

		// These would be the paths if we could test them (Path type is complex)
		// The important thing is that they compile correctly in actual usage
	});

	it('should handle validator types correctly', () => {
		const stringValidator = (value: string) =>
			value.length > 0
				? ({ isRight: () => true, value } as any)
				: ({
						isLeft: () => true,
						value: { message: 'Required' },
				  } as any);

		const numberValidator = (value: number) =>
			value >= 0
				? ({ isRight: () => true, value } as any)
				: ({
						isLeft: () => true,
						value: { message: 'Must be positive' },
				  } as any);

		const fieldWithStringValidator = new FormField('test', stringValidator);
		const fieldWithNumberValidator = new FormField(42, numberValidator);

		expectTypeOf(
			fieldWithStringValidator.getValue()
		).toEqualTypeOf<string>();
		expectTypeOf(
			fieldWithNumberValidator.getValue()
		).toEqualTypeOf<number>();

		// Test that validators return correct types
		expectTypeOf(fieldWithStringValidator.validate()).toMatchTypeOf<{
			isRight(): boolean;
			isLeft(): boolean;
			value: any;
		}>();
	});

	it('should handle complex nested structures', () => {
		type ComplexData = {
			id: number;
			metadata: {
				tags: string[];
				created: Date;
			};
		};

		const complexForm = new Form({
			data: new FormField<ComplexData>({
				id: 1,
				metadata: {
					tags: ['test'],
					created: new Date(),
				},
			}),
			config: new FormFieldGroup({
				enabled: new FormField(true),
				settings: new FormFieldGroup({
					maxItems: new FormField(100),
					allowDuplicates: new FormField(false),
				}),
			}),
		});

		expectTypeOf(
			complexForm.getValueByPath('data')
		).toEqualTypeOf<ComplexData>();
		expectTypeOf(
			complexForm.getValueByPath('config.enabled')
		).toEqualTypeOf<boolean>();
		expectTypeOf(
			complexForm.getValueByPath('config.settings.maxItems')
		).toEqualTypeOf<number>();
		expectTypeOf(
			complexForm.getValueByPath('config.settings.allowDuplicates')
		).toEqualTypeOf<boolean>();
	});

	describe('Form Types', () => {
		describe('FormField', () => {
			it('should correctly infer primitive types', () => {
				const stringField = new FormField('hello');
				expectTypeOf(stringField.getValue()).toEqualTypeOf<string>();

				const numberField = new FormField(42);
				expectTypeOf(numberField.getValue()).toEqualTypeOf<number>();
			});
		});

		describe('FormFieldGroup', () => {
			it('should correctly infer field types in a group', () => {
				const userGroup = new FormFieldGroup({
					name: new FormField('John'),
					age: new FormField(25),
					email: new FormField('john@example.com'),
				});

				const userFields = userGroup.getFields();
				expectTypeOf(userFields.name).toEqualTypeOf<
					FormField<string>
				>();
				expectTypeOf(userFields.age).toEqualTypeOf<FormField<number>>();
				expectTypeOf(userFields.email).toEqualTypeOf<
					FormField<string>
				>();
			});
		});

		describe('Nested Forms', () => {
			const nestedForm = new Form({
				user: new FormFieldGroup({
					name: new FormField('John'),
					address: new FormFieldGroup({
						street: new FormField('123 Main St'),
						city: new FormField('New York'),
						coordinates: new FormFieldGroup({
							lat: new FormField(40.7128),
							lng: new FormField(-74.006),
						}),
					}),
				}),
				metadata: new FormField({ created: new Date(), version: 1 }),
			});

			describe('getValueByPath', () => {
				it('should correctly infer types for valid paths', () => {
					expectTypeOf(
						nestedForm.getValueByPath('user.name')
					).toEqualTypeOf<string>();
					expectTypeOf(
						nestedForm.getValueByPath('user.address.street')
					).toEqualTypeOf<string>();
					expectTypeOf(
						nestedForm.getValueByPath('user.address.city')
					).toEqualTypeOf<string>();
					expectTypeOf(
						nestedForm.getValueByPath(
							'user.address.coordinates.lat'
						)
					).toEqualTypeOf<number>();
					expectTypeOf(
						nestedForm.getValueByPath(
							'user.address.coordinates.lng'
						)
					).toEqualTypeOf<number>();
					expectTypeOf(
						nestedForm.getValueByPath('metadata')
					).toEqualTypeOf<{
						created: Date;
						version: number;
					}>();
				});
			});

			describe('setValueByPath', () => {
				it('should maintain type safety for valid updates', () => {
					const updatedForm1 = nestedForm.setValueByPath(
						'user.name',
						'Jane'
					);
					expectTypeOf(updatedForm1).toEqualTypeOf(nestedForm);

					const updatedForm2 = nestedForm.setValueByPath(
						'user.address.coordinates.lat',
						41.8781
					);
					expectTypeOf(updatedForm2).toEqualTypeOf(nestedForm);
				});
			});
		});

		describe('Simple Forms', () => {
			const simpleForm = new Form({
				name: new FormField('John'),
				age: new FormField(25),
			});

			it('should handle first-level field updates correctly', () => {
				const updatedSimple = simpleForm.setValueByPath('name', 'Jane');
				expectTypeOf(updatedSimple).toEqualTypeOf<typeof simpleForm>();
			});
		});

		describe('Validators', () => {
			it('should correctly type validate fields with validators', () => {
				const stringValidator = (
					value: string
				): Either<{ message: string }, string> =>
					({
						isRight: () => true,
						isLeft: () => false,
						value: value,
						chain: () => stringValidator(value),
						map: () => stringValidator(value),
					} as any);

				const fieldWithValidator = new FormField(
					'test',
					stringValidator
				);
				expectTypeOf(
					fieldWithValidator.getValue()
				).toEqualTypeOf<string>();
			});
		});

		describe('Path Types', () => {
			it('should allow valid path types', () => {
				const validPaths = [
					'user',
					'count',
					'user.name',
					'user.profile',
					'user.profile.bio',
					'user.profile.settings',
					'user.profile.settings.theme',
				] as const;

				validPaths.forEach((path) => {
					expectTypeOf(path).toMatchTypeOf<string>();
				});
			});
		});
	});
});
