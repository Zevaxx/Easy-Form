import { test, expect, describe } from 'vitest';
import fc from 'fast-check';
import { right, left } from '@sweet-monads/either';
import { Form, FormField, FormFieldGroup } from '../src/form/Form';

// Generadores personalizados para fast-check
const arbitraryFormField = <T>(valueArb: fc.Arbitrary<T>) =>
	fc
		.tuple(
			valueArb,
			fc.array(
				fc.func(
					fc.oneof(
						fc
							.record({ message: fc.string() })
							.map((err) => left(err)),
						valueArb.map((val) => right(val))
					)
				)
			)
		)
		.map(([value, validators]) => new FormField(value, validators));

const arbitrarySimpleForm = () =>
	fc
		.record({
			name: arbitraryFormField(fc.string()),
			age: arbitraryFormField(fc.integer({ min: 0, max: 120 })),
			email: arbitraryFormField(fc.emailAddress()),
		})
		.map((fields) => new Form(fields));

// const arbitraryNestedForm = () =>
// 	fc
// 		.record({
// 			personal: fc
// 				.record({
// 					name: arbitraryFormField(fc.string()),
// 					age: arbitraryFormField(fc.integer({ min: 0, max: 120 })),
// 				})
// 				.map((fields) => new FormFieldGroup(fields)),
// 			contact: fc
// 				.record({
// 					email: arbitraryFormField(fc.emailAddress()),
// 					phone: arbitraryFormField(fc.string()),
// 				})
// 				.map((fields) => new FormFieldGroup(fields)),
// 		})
// 		.map((fields) => new Form(fields));

describe('FormField Property Tests', () => {
	test('getValue siempre retorna el valor original', () => {
		fc.assert(
			fc.property(
				fc.oneof(fc.string(), fc.integer(), fc.boolean()),
				(value) => {
					const field = new FormField(value);
					expect(field.getValue()).toEqual(value);
				}
			)
		);
	});

	test('FormField con validadores vacíos siempre pasa validación', () => {
		fc.assert(
			fc.property(
				fc.oneof(fc.string(), fc.integer(), fc.boolean()),
				(value) => {
					const field = new FormField(value, []);
					const result = field.validate();
					expect(result.isRight()).toBe(true);
					if (result.isRight()) {
						expect(result.value).toEqual(value);
					}
				}
			)
		);
	});

	test('FormField con validador que siempre acepta, siempre pasa', () => {
		fc.assert(
			fc.property(fc.string(), (value) => {
				const alwaysValid = (v: string) => right(v);
				const field = new FormField(value, [alwaysValid]);
				const result = field.validate();
				expect(result.isRight()).toBe(true);
			})
		);
	});

	test('FormField con validador que siempre rechaza, siempre falla', () => {
		fc.assert(
			fc.property(fc.string(), (value) => {
				const alwaysInvalid = () => left({ message: 'Always invalid' });
				const field = new FormField(value, [alwaysInvalid]);
				const result = field.validate();
				expect(result.isLeft()).toBe(true);
			})
		);
	});
});

describe('Form Navigation Property Tests', () => {
	test('getValueByPath es consistente - obtener y setear el mismo valor no cambia nada', () => {
		fc.assert(
			fc.property(
				arbitrarySimpleForm(),
				fc.constantFrom('name', 'age', 'email'),
				(form, path) => {
					const originalValue = form.getValueByPath(path);
					const updatedForm = form.setValueByPath(
						path,
						originalValue
					);
					const newValue = updatedForm.getValueByPath(path);

					expect(newValue).toEqual(originalValue);
				}
			)
		);
	});

	test('setValueByPath seguido de getValueByPath retorna el valor seteado', () => {
		fc.assert(
			fc.property(
				arbitrarySimpleForm(),
				fc.string(),
				fc.integer({ min: 0, max: 120 }),
				fc.emailAddress(),
				(form, nameValue, ageValue, emailValue) => {
					// Test para cada campo
					const formWithName = form.setValueByPath('name', nameValue);
					expect(formWithName.getValueByPath('name')).toEqual(
						nameValue
					);

					const formWithAge = form.setValueByPath('age', ageValue);
					expect(formWithAge.getValueByPath('age')).toEqual(ageValue);

					const formWithEmail = form.setValueByPath(
						'email',
						emailValue
					);
					expect(formWithEmail.getValueByPath('email')).toEqual(
						emailValue
					);
				}
			)
		);
	});

	test('setValueByPath es inmutable - el form original no cambia', () => {
		fc.assert(
			fc.property(
				arbitrarySimpleForm(),
				fc.string(),
				(form, newValue) => {
					const originalName = form.getValueByPath('name');
					const updatedForm = form.setValueByPath('name', newValue);

					// El form original no debe cambiar
					expect(form.getValueByPath('name')).toEqual(originalName);
					// El nuevo form debe tener el nuevo valor
					expect(updatedForm.getValueByPath('name')).toEqual(
						newValue
					);
				}
			)
		);
	});

	test('múltiples setValueByPath son asociativos (el orden no importa para campos diferentes)', () => {
		fc.assert(
			fc.property(
				arbitrarySimpleForm(),
				fc.string(),
				fc.integer({ min: 0, max: 120 }),
				(form, nameValue, ageValue) => {
					// Aplicar cambios en un orden
					const form1 = form
						.setValueByPath('name', nameValue)
						.setValueByPath('age', ageValue);

					// Aplicar cambios en orden inverso
					const form2 = form
						.setValueByPath('age', ageValue)
						.setValueByPath('name', nameValue);

					// Ambos resultados deben ser iguales
					expect(form1.getValueByPath('name')).toEqual(
						form2.getValueByPath('name')
					);
					expect(form1.getValueByPath('age')).toEqual(
						form2.getValueByPath('age')
					);
				}
			)
		);
	});
});

describe('Form Validation Property Tests', () => {
	test('Form sin validadores siempre pasa validación si los campos individuales pasan', () => {
		fc.assert(
			fc.property(
				fc.record({
					name: fc.string(),
					age: fc.integer({ min: 0, max: 120 }),
				}),
				(values) => {
					const form = new Form({
						name: new FormField(values.name, []),
						age: new FormField(values.age, []),
					});

					const result = form.validateForm();
					expect(result.isRight()).toBe(true);
				}
			)
		);
	});

	test('Validación es determinística - misma entrada, mismo resultado', () => {
		fc.assert(
			fc.property(arbitrarySimpleForm(), (form) => {
				const result1 = form.validateForm();
				const result2 = form.validateForm();

				expect(result1.isLeft()).toEqual(result2.isLeft());
				expect(result1.isRight()).toEqual(result2.isRight());

				if (result1.isRight() && result2.isRight()) {
					expect(result1.value).toEqual(result2.value);
				}
			})
		);
	});
});

describe('Nested Form Property Tests', () => {
	test('Navegación anidada: getValueByPath funciona correctamente', () => {
		fc.assert(
			fc.property(
				fc.string(),
				fc.integer({ min: 0, max: 120 }),
				fc.emailAddress(),
				(name, age, email) => {
					const form = new Form({
						personal: new FormFieldGroup({
							name: new FormField(name),
							age: new FormField(age),
						}),
						contact: new FormFieldGroup({
							email: new FormField(email),
						}),
					});

					expect(form.getValueByPath('personal.name')).toEqual(name);
					expect(form.getValueByPath('personal.age')).toEqual(age);
					expect(form.getValueByPath('contact.email')).toEqual(email);
				}
			)
		);
	});

	test('setValueByPath anidado mantiene otros valores intactos', () => {
		fc.assert(
			fc.property(
				fc.string(),
				fc.string(),
				fc.integer(),
				(originalName, newName, age) => {
					const form = new Form({
						personal: new FormFieldGroup({
							name: new FormField(originalName),
							age: new FormField(age),
						}),
					});

					const updatedForm = form.setValueByPath(
						'personal.name',
						newName
					);

					// El nuevo valor debe estar presente
					expect(updatedForm.getValueByPath('personal.name')).toEqual(
						newName
					);
					// Otros valores deben mantenerse
					expect(updatedForm.getValueByPath('personal.age')).toEqual(
						age
					);
				}
			)
		);
	});
});

describe('Invariants and Edge Cases', () => {
	test('Path splitting es consistente', () => {
		fc.assert(
			fc.property(
				fc.array(
					fc.string().filter((s) => !s.includes('.')),
					{ minLength: 1, maxLength: 3 }
				),
				(pathParts) => {
					const path = pathParts.join('.');
					const splitPath = path.split('.');
					expect(splitPath).toEqual(pathParts);
				}
			)
		);
	});

	test('FormField constructor maneja tanto array como validator individual', () => {
		fc.assert(
			fc.property(fc.string(), (value) => {
				const validator = (v: string) => right(v);

				// Constructor con validator individual
				const field1 = new FormField(value, validator);
				// Constructor con array de validators
				const field2 = new FormField(value, [validator]);

				// Ambos deben comportarse igual
				const result1 = field1.validate();
				const result2 = field2.validate();

				expect(result1.isRight()).toEqual(result2.isRight());
				if (result1.isRight() && result2.isRight()) {
					expect(result1.value).toEqual(result2.value);
				}
			})
		);
	});

	test('Operaciones en cadena preservan la estructura del form', () => {
		fc.assert(
			fc.property(
				arbitrarySimpleForm(),
				fc.string(),
				fc.string(),
				(form, value1, value2) => {
					const result = form
						.setValueByPath('name', value1)
						.setValueByPath('name', value2);

					// El resultado final debe tener el último valor
					expect(result.getValueByPath('name')).toEqual(value2);

					// La estructura del form debe mantenerse
					expect(typeof result.getValueByPath('age')).toBe('number');
					expect(typeof result.getValueByPath('email')).toBe(
						'string'
					);
				}
			)
		);
	});
});

describe('Error Handling Property Tests', () => {
	test('getValueByPath con path inválido siempre lanza error', () => {
		fc.assert(
			fc.property(
				arbitrarySimpleForm(),
				fc
					.string()
					.filter((s) => !['name', 'age', 'email'].includes(s)),
				(form, invalidPath) => {
					expect(() => {
						form.getValueByPath(invalidPath as any);
					}).toThrow();
				}
			)
		);
	});

	test('setValueByPath con path inválido siempre lanza error', () => {
		fc.assert(
			fc.property(
				arbitrarySimpleForm(),
				fc
					.string()
					.filter((s) => !['name', 'age', 'email'].includes(s)),
				fc.string(),
				(form, invalidPath, value) => {
					expect(() => {
						form.setValueByPath(invalidPath as any, value);
					}).toThrow();
				}
			)
		);
	});
});

describe('FormFieldGroup Property Tests', () => {
	test('FormFieldGroup permite anidar FormFields correctamente', () => {
		fc.assert(
			fc.property(
				fc.string(),
				fc.integer({ min: 0, max: 120 }),
				(name, age) => {
					const group = new FormFieldGroup({
						name: new FormField(name),
						age: new FormField(age),
					});

					expect(group.getValueByPath('name')).toEqual(name);
					expect(group.getValueByPath('age')).toEqual(age);
				}
			)
		);
	});

	test('setValueByPath en FormFieldGroup actualiza correctamente valores anidados', () => {
		fc.assert(
			fc.property(
				fc.string(),
				fc.string(),
				fc.integer({ min: 0, max: 120 }),
				(originalName, newName, age) => {
					const group = new Form({
						name: new FormField(originalName),
						age: new FormField(age),
					});

					const updatedGroup = group.setValueByPath('name', newName);

					expect(updatedGroup.getValueByPath('name')).toEqual(
						newName
					);
					expect(updatedGroup.getValueByPath('age')).toEqual(age);
				}
			)
		);
	});
});
